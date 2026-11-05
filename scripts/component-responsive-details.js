// A media-qualified text cursor turns a summary into a static section heading.
// Preserve that source breakpoint without hardcoding a theme or viewport width.
(()=>{
 const pairs=[...document.querySelectorAll('details > summary')].filter(summary=>!summary.closest('[data-migration-details],[data-migration-responsive-details="preserve"]')).map(summary=>({summary,item:summary.parentElement,queries:[]}));
 if(!pairs.length)return;
 function visit(rules,media=[]){
  for(const rule of rules){
   if(rule.type===CSSRule.SUPPORTS_RULE&&!CSS.supports(rule.conditionText))continue;
   if(rule.type===CSSRule.MEDIA_RULE){visit(rule.cssRules,[...media,rule.conditionText]);continue;}
   if(rule.cssRules?.length)visit(rule.cssRules,media);
   if(!media.some(query=>/\b(?:min-|max-)?width\b/.test(query))||rule.style?.cursor!=='text'||!rule.selectorText)continue;
   for(const pair of pairs)try{if(pair.summary.matches(rule.selectorText))pair.queries.push(media.map(query=>matchMedia(query)));}catch{}
  }
 }
 for(const sheet of document.styleSheets)try{visit(sheet.cssRules);}catch{} // Inaccessible styles are not evidence.
 for(const {summary,item,queries}of pairs){
  if(!queries.length)continue;
  let previous;
  const sync=()=>{
   const isStatic=queries.some(group=>group.every(query=>query.matches))&&getComputedStyle(summary).cursor==='text';
   if(isStatic===previous)return;previous=isStatic;
   item.open=isStatic;summary.setAttribute('aria-expanded',String(item.open));
  };
  for(const group of queries)for(const query of group)query.addEventListener('change',sync);
  summary.addEventListener('click',event=>{if(previous&&!event.target.closest('a,button,input,select,textarea'))event.preventDefault();});
  item.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(item.open)));
  sync();
 }
})();
