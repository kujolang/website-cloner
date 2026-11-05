// Declared groups receive exclusivity, ARIA and keyboard navigation.
// Optional source timing uses native Web Animations; plain details remain native.
(()=>{
 for(const root of document.querySelectorAll('[data-migration-details]')){
  const items=[...root.querySelectorAll('details')].filter(item=>item.closest('[data-migration-details]')===root);
  const pairs=items.map(item=>({item,summary:[...item.children].find(el=>el.tagName==='SUMMARY')})).filter(pair=>pair.summary);
  const transitions=new Map(),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const configured=Number(root.dataset.migrationDetailsDuration);
  const duration=Number.isFinite(configured)&&configured>0?configured:0;
  const wantsOpen=item=>transitions.get(item)?.open??item.open;
  const sync=()=>{for(const {item,summary} of pairs){summary.setAttribute('aria-expanded',String(wantsOpen(item)));summary.tabIndex=0;}};
  const settle=(item,state)=>{
   if(transitions.get(item)!==state)return;
   state.animation.cancel();item.open=state.open;
   item.style.height=state.original.height;item.style.overflow=state.original.overflow;
   transitions.delete(item);sync();
  };
  motion.addEventListener('change',()=>{if(motion.matches)for(const [item,state]of [...transitions])settle(item,state);});
  const change=(item,open)=>{
   const previous=transitions.get(item),start=item.getBoundingClientRect().height;
   const original=previous?.original||{height:item.style.height,overflow:item.style.overflow};
   previous?.animation.cancel();
   item.style.height=original.height;item.style.overflow=original.overflow;
   item.open=open;const end=item.getBoundingClientRect().height;item.open=true;
   item.style.overflow='hidden';
   const animation=item.animate({height:[start+'px',end+'px']},{duration,easing:'linear'});
   const state={animation,open,original};transitions.set(item,state);sync();
   animation.onfinish=()=>settle(item,state);
  };
  for(const {item,summary} of pairs){
   item.addEventListener('toggle',()=>{
    if(transitions.has(item)){sync();return;}
    if(item.open&&root.dataset.migrationDetails!=='multiple')for(const other of pairs)if(other.item!==item)other.item.open=false;
    sync();
   });
   summary.addEventListener('click',event=>{
    if(!duration||!item.animate||motion.matches)return;
    if(event.target.closest('a,button,input,select,textarea'))return;
    event.preventDefault();const open=!wantsOpen(item);
    if(open&&root.dataset.migrationDetails!=='multiple')for(const other of pairs)if(other.item!==item&&wantsOpen(other.item))change(other.item,false);
    change(item,open);
   });
   summary.addEventListener('keydown',event=>{
    if(event.target!==summary)return;
    const index=pairs.findIndex(pair=>pair.summary===summary);
    const next=event.key==='Home'?0:event.key==='End'?pairs.length-1:event.key==='ArrowDown'?(index+1)%pairs.length:event.key==='ArrowUp'?(index+pairs.length-1)%pairs.length:null;
    if(next!==null){event.preventDefault();pairs[next].summary.focus();}
   });
  }
  sync();
 }
})();
