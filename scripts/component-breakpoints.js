(()=>{
 'use strict';
 const roots=[];
 document.querySelectorAll('[data-migration-container-breakpoints]').forEach(root=>{
  let config;try{config=JSON.parse(root.getAttribute('data-migration-container-breakpoints'));}catch{return;}
  if(!config||typeof config!=='object'||Array.isArray(config)||!config.widths||typeof config.widths!=='object'||Array.isArray(config.widths))return;
  if(!/^[a-z][a-z0-9_-]{0,60}-$/.test(config.prefix||''))return;
  const entries=Object.entries(config.widths||{});if(!entries.length||entries.length>20||entries.some(([key,value])=>!/^[a-z][a-z0-9-]{0,30}$/.test(key)||!Number.isFinite(value)||value<0||value>10000))return;
  const update=()=>{const width=root.getBoundingClientRect().width;for(const [key,min]of entries)root.classList.toggle(config.prefix+key,width>=min);};
  roots.push({root,update});update();
 });
 let pending=false;const refresh=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;roots.forEach(x=>x.update());});};
 if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(refresh);roots.forEach(x=>observer.observe(x.root));}
 else window.addEventListener('resize',refresh);
})();
