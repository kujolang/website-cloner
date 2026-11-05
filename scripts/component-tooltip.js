(()=>{
 const selector='[data-js~="tribe-events-tooltip"][data-tooltip-content]';
 let active,opening,closing;
 const over=e=>e?.matches(':hover')||e?.contains(document.activeElement);
 function close(){clearTimeout(opening);clearTimeout(closing);if(!active)return;const {tip,placeholder,portal}=active;active=null;if(placeholder.parentNode)placeholder.replaceWith(tip);else tip.remove();portal.remove();}
 function deferClose(){clearTimeout(closing);closing=setTimeout(()=>{if(active&&!over(active.trigger)&&!over(active.portal))close();},300);}
 function open(trigger){
  const ref=trigger.getAttribute('data-tooltip-content');if(!ref?.startsWith('#'))return;
  const tip=document.getElementById(ref.slice(1));if(!tip||tip.getAttribute('role')!=='tooltip')return;
  if(active?.trigger===trigger)return;close();
  const placeholder=document.createComment('local tooltip');tip.replaceWith(placeholder);
  const portal=document.createElement('div');portal.className='tooltipster-base tooltipster-sidetip tribe-events-tooltip-theme tribe-common tribe-events tooltipster-top tooltipster-show';portal.dataset.clonerTooltip='';
  const box=document.createElement('div');box.className='tooltipster-box';const content=document.createElement('div');content.className='tooltipster-content';content.append(tip);box.append(content);portal.append(box);
  Object.assign(portal.style,{position:'fixed',pointerEvents:'auto',zIndex:'9999999',left:'0',top:'0',width:'max-content',visibility:'hidden'});document.body.append(portal);
  active={trigger,tip,placeholder,portal};const origin=trigger.getBoundingClientRect(),bounds=portal.getBoundingClientRect();let top=origin.top-bounds.height-6;
  if(top<0){top=origin.bottom+6;portal.classList.replace('tooltipster-top','tooltipster-bottom');}
  portal.style.left=Math.max(0,Math.min(innerWidth-bounds.width,Math.floor(Math.floor(origin.left+origin.width/2)-bounds.width/2)))+'px';portal.style.top=Math.max(0,Math.min(innerHeight-bounds.height,top))+'px';portal.style.visibility='visible';
  portal.addEventListener('pointerenter',()=>clearTimeout(closing));portal.addEventListener('pointerleave',deferClose);portal.addEventListener('focusout',deferClose);
 }
 function schedule(trigger){clearTimeout(opening);clearTimeout(closing);opening=setTimeout(()=>{if(trigger.isConnected&&over(trigger))open(trigger);},300);}
 document.addEventListener('pointerover',e=>{const trigger=e.target.closest(selector);if(trigger&&!trigger.contains(e.relatedTarget))schedule(trigger);});
 document.addEventListener('pointerout',e=>{const trigger=e.target.closest(selector);if(trigger&&!trigger.contains(e.relatedTarget)){clearTimeout(opening);deferClose();}});
 document.addEventListener('focusin',e=>{const trigger=e.target.closest(selector);if(trigger)schedule(trigger);});
 document.addEventListener('focusout',e=>{if(e.target.closest(selector))deferClose();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){const trigger=active.trigger;close();clearTimeout(opening);if(!trigger.contains(document.activeElement)){trigger.focus();clearTimeout(opening);}e.preventDefault();}});
 document.addEventListener('pointerdown',e=>{if(active&&!active.portal.contains(e.target)&&!active.trigger.contains(e.target))close();});
 addEventListener('resize',close);document.addEventListener('scroll',close,true);
 new MutationObserver(()=>{if(active&&!active.trigger.isConnected)close();}).observe(document.body,{childList:true,subtree:true});
})();
