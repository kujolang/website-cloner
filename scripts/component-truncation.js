(()=>{
 const roots=[...document.querySelectorAll('[data-migration-truncate-lines]')];if(!roots.length)return;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)return;
 for(const root of roots){
  const content=root.querySelector('[data-migration-truncate-content]'),suffix=root.querySelector('[data-migration-truncate-suffix]');if(!content||!suffix)continue;
  const copy=content.cloneNode(true);copy.querySelectorAll('br').forEach(e=>e.replaceWith(' '));let text=copy.textContent.replace(/\s+/g,' ').trim(),tail=suffix.textContent.replace(/\s+/g,' ').trim(),lines=Number(root.dataset.migrationTruncateLines);if(!text||!Number.isInteger(lines)||lines<1||lines>12)continue;
  const preclipped=Boolean(content.querySelector('a'))&&text.endsWith(tail);if(preclipped)text=text.slice(0,-tail.length).trim();
  const originalSuffix=suffix.cloneNode(true);let last='';
  const render=()=>{const parent=root.parentElement,box=getComputedStyle(parent),width=parent.clientWidth-parseFloat(box.paddingLeft)-parseFloat(box.paddingRight),style=getComputedStyle(content);if(!width)return;const key=width+'|'+style.font+'|'+style.letterSpacing+'|'+style.wordSpacing;if(last===key)return;last=key;ctx.font=style.font;const letters=parseFloat(style.letterSpacing)||0,spaces=parseFloat(style.wordSpacing)||0,measure=value=>ctx.measureText(value).width+Math.max(0,[...value].length-1)*letters+(value.match(/ /g)||[]).length*spaces;const words=text.split(' '),rows=[];let line='';
   for(const word of words){const next=line?line+' '+word:word;if(line&&measure(next)>width){rows.push(line);line=word;}else line=next;}if(line)rows.push(line);
   const clipped=preclipped||rows.length>lines;let shown=rows.slice(0,lines);if(clipped){let end=shown[shown.length-1];const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(end)].map(x=>x.segment):[...end];while(parts.length&&measure(parts.join('')+' '+tail)>width)parts.pop();end=parts.join('').trimEnd();shown[shown.length-1]=end;}
   content.replaceChildren();shown.forEach((value,i)=>{if(i)content.append(document.createElement('br'));content.append(document.createTextNode(value));});suffix.hidden=true;
   if(clipped){const end=originalSuffix.cloneNode(true);end.removeAttribute('style');end.removeAttribute('data-migration-truncate-suffix');end.hidden=false;content.append(document.createTextNode(' '),end);}
  };
  const observer=new ResizeObserver(render);observer.observe(root.parentElement);document.fonts?.ready.then(()=>{last='';render();});render();
 }
})();
