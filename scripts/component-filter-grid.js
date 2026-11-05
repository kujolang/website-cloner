// Shared filtering for fully captured grids; source CSS retains responsive widths.
(()=>{
 const selector='[data-migration-filter]';
 for(const root of document.querySelectorAll(selector)){
  if(root.dataset.migrationFilterReady)continue;
  const container=[...root.querySelectorAll('[data-migration-filter-items]')].find(e=>e.closest(selector)===root);
  if(!container)continue;
  const items=[...container.children].filter(e=>e.hasAttribute('data-migration-filter-item'));
  const controls=[...root.querySelectorAll('[data-migration-filter-value]')].filter(e=>e.closest(selector)===root);
  if(!items.length||!controls.length)continue;
  root.dataset.migrationFilterReady='true';
  const masonry=root.dataset.migrationFilterLayout==='masonry';
  container.style.display=masonry?'block':'flex';container.style.flexWrap='wrap';container.style.alignItems='flex-start';container.style.height='auto';
  function layout(){
   if(!masonry)return;
   const visible=items.filter(item=>!item.hidden),style=getComputedStyle(container),number=v=>parseFloat(v)||0;
   const paddingLeft=number(style.paddingLeft),paddingRight=number(style.paddingRight),paddingTop=number(style.paddingTop);
   const heightExtra=style.boxSizing==='border-box'?paddingTop+number(style.paddingBottom)+number(style.borderTopWidth)+number(style.borderBottomWidth):0;
   const setHeight=height=>container.style.height=(height+heightExtra)+'px';
   const width=container.clientWidth-paddingLeft-paddingRight;
   if(!width)return;
   if(!visible.length){setHeight(0);return;}
   const outer=item=>{const s=getComputedStyle(item),rect=item.getBoundingClientRect();return {width:rect.width+number(s.marginLeft)+number(s.marginRight),height:rect.height+number(s.marginTop)+number(s.marginBottom)};};
   const column=outer(visible[0]).width;if(!column)return;
   const count=Math.max(1,Math.floor((width+1)/column)),heights=Array(count).fill(0),rtl=style.direction==='rtl';
   container.style.position='relative';
   for(const item of visible){
    const size=outer(item),span=Math.max(1,Math.min(count,Math.ceil((size.width-1)/column)));
    let chosen=0,y=Infinity;
    for(let i=0;i<=count-span;i++){const top=Math.max(...heights.slice(i,i+span));if(top<y){chosen=i;y=top;}}
    item.style.position='absolute';item.style.top=(paddingTop+y)+'px';item.style[rtl?'right':'left']=((rtl?paddingRight:paddingLeft)+chosen*column)+'px';item.style[rtl?'left':'right']='auto';
    for(let i=chosen;i<chosen+span;i++)heights[i]=y+size.height;
   }
   setHeight(Math.max(...heights));
  }
  let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;layout();});};
  for(const item of items){item.style.position='relative';item.style.left='auto';item.style.top='auto';item.style.transform='none';item.style.opacity='1';}
  const search=[...root.querySelectorAll('[data-migration-filter-search]')].find(e=>e.closest(selector)===root);
  const empty=[...root.querySelectorAll('[data-migration-filter-empty]')].find(e=>e.closest(selector)===root);
  const toggle=[...root.querySelectorAll('[data-migration-filter-toggle]')].find(e=>e.closest(selector)===root);
  const menu=[...root.querySelectorAll('[data-migration-filter-menu]')].find(e=>e.closest(selector)===root);
  const closeMenu=()=>{menu?.classList.remove('open-filters');toggle?.setAttribute('aria-expanded','false');};
  const loaded=new Set(items.filter(item=>item.dataset.migrationFilterLoaded!=='false'));
  const batch=Number(container.dataset.migrationFilterBatch)||items.length,visited=new Set();
  const more=[...root.querySelectorAll('[data-migration-filter-more]')].find(e=>e.closest(selector)===root);
  const matches=(item,value)=>value==='*'||item.classList.contains(value);
  function reveal(value,count){for(const item of items.filter(item=>!loaded.has(item)&&matches(item,value)).slice(0,Math.max(0,count))){loaded.add(item);container.append(item);items.splice(items.indexOf(item),1);items.push(item);}}
  let selected;
  function select(control,reason='filter'){
   selected=control;
   if(toggle){const label=toggle.querySelector('span');if(label)label.textContent=control.textContent.trim();closeMenu();}
   const query=(search?.value||'').trim().toLocaleLowerCase();
   const value=control.dataset.migrationFilterValue;
   if(value!=='*'&&!/^[\p{L}_][\p{L}\p{N}_-]*$/u.test(value))return;
   if(reason==='filter'&&!visited.has(control)){visited.add(control);if(value!=='*')reveal(value,batch-items.filter(item=>loaded.has(item)&&matches(item,value)).length);}
   if(reason==='search'&&container.dataset.migrationFilterSearchAll==='true')reveal('*',items.length);
   for(const c of controls){const active=c===control;c.classList.toggle('active',active);c.setAttribute('aria-pressed',String(active));}
   for(const item of items){const visible=loaded.has(item)&&matches(item,value)&&(!query||(item.textContent+' '+(item.getAttribute('data-search-categories')||'')).toLocaleLowerCase().includes(query));item.hidden=!visible;item.inert=!visible;item.setAttribute('aria-hidden',String(!visible));if(visible)item.style.removeProperty('display');else item.style.setProperty('display','none','important');}
   if(empty){const show=items.every(item=>item.hidden);empty.hidden=!show;empty.style.display=show?'block':'none';empty.style.flexBasis='100%';const factor=Number(root.dataset.migrationFilterEmptySpacing);if(factor>0)container.style.minHeight=(parseInt(getComputedStyle(empty).fontSize)*factor)+'px';}
   if(more){const available=items.some(item=>!loaded.has(item)&&matches(item,value));more.hidden=!available;if(available)more.style.removeProperty('display');else more.style.setProperty('display','none','important');}
   layout();
   root.dispatchEvent(new CustomEvent('migration:component-change',{bubbles:true}));
  }
  for(const control of controls){
   control.setAttribute('role','button');control.tabIndex=0;if(control.tagName==='BUTTON')control.type='button';
   control.addEventListener('click',event=>{event.preventDefault();select(control);});
   control.addEventListener('keydown',event=>{if(event.target!==control)return;if(['Enter',' '].includes(event.key)&&control.tagName!=='BUTTON'){event.preventDefault();select(control);}else if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const i=controls.indexOf(control);controls[event.key==='Home'?0:event.key==='End'?controls.length-1:(i+(event.key==='ArrowRight'?1:-1)+controls.length)%controls.length].focus();}});
  }
  if(toggle&&menu){toggle.type='button';closeMenu();toggle.addEventListener('click',()=>{const open=menu.classList.toggle('open-filters');toggle.setAttribute('aria-expanded',String(open));});root.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.classList.contains('open-filters')){closeMenu();toggle.focus();}});document.addEventListener('click',event=>{if(!root.contains(event.target))closeMenu();});}
  if(more){more.setAttribute('role','button');more.tabIndex=0;if(more.tagName==='BUTTON')more.type='button';more.addEventListener('click',event=>{event.preventDefault();reveal(selected.dataset.migrationFilterValue,batch);select(selected,'more');});if(more.tagName!=='BUTTON')more.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();more.click();}});}
  if(search){search.addEventListener('input',()=>select(selected,'search'));search.closest('form')?.addEventListener('submit',event=>{event.preventDefault();select(selected,'search');});}
  if(masonry){
   let lastWidth;new ResizeObserver(()=>{if(container.clientWidth!==lastWidth){lastWidth=container.clientWidth;schedule();}}).observe(container);
   const sizes=new ResizeObserver(schedule);items.forEach(item=>sizes.observe(item));
   container.querySelectorAll('img').forEach(image=>image.addEventListener('load',schedule));document.fonts?.ready.then(schedule);
  }
  select(controls.find(c=>c.getAttribute('aria-pressed')==='true')||controls[0],'filter');
 }
})();
