(()=>{
 'use strict';
 // Responsive themes hide headings at different breakpoints. Recalculate only
 // builder-marked levels, leaving explicit source ARIA levels untouched.
 let headingFrame=0;
 const headings=()=>{headingFrame=0;let previous=0;
  for(const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')){
   if(el.closest('[hidden],[aria-hidden="true"],[inert]')||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue;
   const original=Number(el.dataset.migrationHeadingLevel),level=original||Number(el.getAttribute('aria-level'))||Number(el.tagName.slice(1));if(!level)continue;
   const corrected=original&&previous&&level>previous+1?previous+1:level;
   if(original)el.setAttribute('aria-level',String(corrected));previous=corrected;
  }
 };
 const schedule=()=>{if(!headingFrame)headingFrame=requestAnimationFrame(headings);};
 schedule();addEventListener('resize',schedule,{passive:true});document.fonts?.ready.then(schedule);
 document.addEventListener('migration:carousel-change',schedule);
 document.addEventListener('migration:component-change',schedule);

 // A clone preserves source colours. Accessibility auditing remains separate;
 // site owners can explicitly request colour repair on the exported document.
 if(document.documentElement.getAttribute('data-migration-contrast')!=='repair')return;
 // Correct only measurable solid-color contrast. Images, gradients, blending
 // and opacity need visual review; never guess their effective background.
 const rgb=value=>{const m=/^rgba?\(([^)]+)\)$/.exec(value);if(!m)return null;const n=m[1].split(/[,\s/]+/).filter(Boolean).map(Number);return n.length===3||n[3]===1?n.slice(0,3):null;};
 const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),elements=new Set();while(walker.nextNode())if(walker.currentNode.textContent.trim())elements.add(walker.currentNode.parentElement);
 for(const el of elements){
  if(el.closest('script,style,svg,[hidden],[aria-hidden=true]')||!el.getClientRects().length)continue;
  const style=getComputedStyle(el),foreground=rgb(style.color);if(!foreground)continue;
  let background=null,unsafe=false;
  for(let node=el;node;node=node.parentElement){const s=getComputedStyle(node);if(Number(s.opacity)!==1||s.mixBlendMode!=='normal'||s.filter!=='none'){unsafe=true;break;}if(s.backgroundImage!=='none'){unsafe=true;break;}const color=rgb(s.backgroundColor);if(color){background=color;break;}if(s.backgroundColor!=='rgba(0, 0, 0, 0)'&&s.backgroundColor!=='transparent'){unsafe=true;break;}}
  if(unsafe)continue;background||=[255,255,255];
  // Some themes hide the full title with font-size:0 and paint a large initial.
  // Apply the large-text requirement to that visible glyph, not the hidden text.
  let size=parseFloat(style.fontSize);
  if(size===0)size=parseFloat(getComputedStyle(el,'::first-letter').fontSize)||0;
  if(size===0)continue;
  const target=size>=24||(size>=18.66&&Number(style.fontWeight)>=700)?3:4.5;
  if(ratio(foreground,background)>=target)continue;
  let best=null;
  for(const endpoint of [0,255])for(let step=1;step<=100;step++){const candidate=foreground.map(v=>Math.round(v+(endpoint-v)*step/100));if(ratio(candidate,background)>=target+.05){if(!best||step<best.step)best={step,color:candidate};break;}}
  if(best){el.style.color=`rgb(${best.color.join(',')})`;el.setAttribute('data-migration-contrast-adjusted','true');}
 }
})();
