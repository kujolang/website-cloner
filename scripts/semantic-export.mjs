// Runs on every build, including edits made to the exported Markdown project.
export function semanticExport($, titles = new Map(), primaryTitle = '') {
 // Promote an existing tooltip name only when no stronger control label exists.
 const labelledIds=new Set($('label[for]').map((_,el)=>$(el).attr('for')).get());
 $('input[title]:not([type=hidden]),select[title],textarea[title]').each((_,el)=>{
  const control=$(el),title=control.attr('title')?.trim();
  if(!title||control.attr('aria-label')||control.attr('aria-labelledby')||control.closest('label').length||labelledIds.has(control.attr('id')))return;
  control.attr('aria-label',title);
 });
 // WordPress lightbox templates without a bound source are not content images.
 $('img:not([src])[data-wp-bind--src]').remove();
 if(!$('main,[role=main]').length){
  const root=$('.wp-site-blocks').first();
  if(root.length){const content=root.children().filter((_,e)=>!['header','footer','script','style'].includes(e.tagName));if(content.length)content.wrapAll('<main style="display:contents"></main>');}
  else {
   // Page-builder documents often have a single content root and no semantic main.
   const candidates=$('[data-elementor-type="wp-page"],[data-elementor-type="wp-post"],[data-elementor-type="archive"],[data-elementor-type="single-post"],#content,.site-content,#main');
   // A theme wrapper may also contain shared site chrome. Never promote it
   // to main: that turns its banner/footer into incorrectly nested landmarks.
   const containsChrome=el=>$(el).find('[role=banner],[role=contentinfo],header:not(article header):not(section header),footer:not(article footer):not(section footer)').length>0;
   const safe=candidates.filter((_,el)=>$(el).find('h1').length&&!$(el).closest('[hidden],[aria-hidden="true"],nav,header,footer').length&&!containsChrome(el)).first();
   if(safe.length)safe.attr('role','main');
   else {
    const article=$('article').filter((_,el)=>!$(el).closest('[hidden],[aria-hidden="true"],nav,header,footer').length).first(),parent=article.parent();
    if(article.length){const content=parent.length&&!parent.is('body')&&!containsChrome(parent[0])?parent:article;content.attr('role','main');}
   }
  }
 }
 const main=$('main,[role=main]').first();
 if(primaryTitle&&!$('h1').length){const heading=$('<h1 class="migration-primary-heading" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"></h1>').text(primaryTitle);const host=main.length?(main.children('div').first().length?main.children('div').first():main):$('body');host.append(heading);}
 const heads=$('h1'),visible=heads.filter((_,node)=>!$(node).closest('[hidden],[aria-hidden="true"],template').length&&$(node).text().trim());
 const primary=main.find('h1').filter((_,node)=>visible.toArray().includes(node)).first()[0]||visible.filter((_,node)=>!$(node).closest('header,footer,nav,aside').length).first()[0]||visible.first()[0]||heads.first()[0];
 heads.filter((_,node)=>node!==primary).each((_,node)=>{node.tagName='div';$(node).attr('role','heading').attr('aria-level','2').attr('data-migration-source-heading','h1');});
 if(main.length){
  $('a[class]').filter((_,el)=>($(el).attr('class')||'').split(/\s+/).some(name=>/(?:^|-)skip-(?:link|to-content)$/.test(name))).each((_,el)=>{const link=$(el),href=link.attr('href')||'';if(!/^#[^#]+$/.test(href))return;let target;try{target=decodeURIComponent(href.slice(1));}catch{return;}
   if($('[id]').toArray().some(n=>n.attribs.id===target))return;
   let id=main.attr('id');if(!id){id='migration-main';let n=2;while($('[id]').toArray().some(e=>e.attribs.id===id))id='migration-main-'+n++;main.attr('id',id);}
   if(!main.attr('tabindex'))main.attr('tabindex','-1');link.attr('href','#'+id);
  });
 }
 const linkNames=new Map();
 $('a[href]').each((_,el)=>{const a=$(el),name=a.text().trim()||a.attr('aria-label');if(!name)return;const href=a.attr('href');if(!linkNames.has(href))linkNames.set(href,new Set());linkNames.get(href).add(name);});
 // Correct skipped heading levels in the accessibility tree without changing
 // source tags/classes or CSS. Explicit authored ARIA levels remain authoritative.
 let previous=0;
 $('h1,h2,h3,h4,h5,h6,[role=heading]').each((_,el)=>{
  const heading=$(el);if(heading.closest('[hidden],[aria-hidden="true"],template').length)return;
  const level=Number(heading.attr('aria-level'))||Number(el.tagName.slice(1));
  if(!level)return;
  const authored=!heading.attr('data-migration-heading-level')&&heading.attr('aria-level');
  if(!authored)heading.attr('data-migration-heading-level',heading.attr('data-migration-heading-level')||String(level));
  const corrected=previous&&level>previous+1&&!authored?previous+1:level;
  if(corrected!==level)heading.attr('aria-level',String(corrected));previous=corrected;
 });
 const regionNames=new Map();
 $('[role=region][aria-label]').each((_,el)=>{const region=$(el),label=region.attr('aria-label');regionNames.set(label,(regionNames.get(label)||0)+1);});
 const seen=new Map();
 $('[role=region][aria-label]').each((_,el)=>{const region=$(el),label=region.attr('aria-label');if(regionNames.get(label)<2||region.attr('aria-labelledby'))return;const n=(seen.get(label)||0)+1;seen.set(label,n);region.attr('aria-label',label+' '+n);});
 $('a[href]').each((_,el)=>{
  const a=$(el),name=a.text().trim()||a.attr('aria-label')||a.find('img[alt]').attr('alt')||a.find('svg title').text();
  if(a.attr('aria-hidden')==='true'){a.attr('tabindex','-1');return;}
  if(name)return;
  const href=a.attr('href'),names=linkNames.get(href),contact=/^tel:[+()0-9 .-]+$/i.test(href)?'Call '+href.slice(4):'';
  const title=contact||(names?.size===1?[...names][0]:'')||titles.get(href)||a.attr('title')||a.closest('article,.wp-block-group').find('h1,h2,h3,h4').first().text().trim();
  if(title)a.attr('aria-label',title);
 });
 $('aside,[role=complementary]').each((index,el)=>{const landmark=$(el);if(landmark.attr('aria-label')||landmark.attr('aria-labelledby'))return;const heading=landmark.find('h1,h2,h3,h4,h5,h6').first().text().trim();landmark.attr('aria-label',heading||'Additional information '+(index+1));});
 // Recognized accessibility-helper chrome remains outside the page's main.
 $('#wp_access_helper_container:not([role])').each((_,el)=>{const region=$(el),label=region.find('button[aria-label]').first().attr('aria-label');if(label)region.attr('role','complementary').attr('aria-label',label);});
 const navs=$('nav,[role=navigation]');
 navs.each((index,el)=>{const nav=$(el);if(!nav.attr('aria-label')&&!nav.attr('aria-labelledby')&&navs.length>1)nav.attr('aria-label',/mobile/i.test((nav.attr('class')||'')+' '+(nav.attr('id')||''))?'Mobile navigation':'Navigation '+(index+1));});
  $('[aria-hidden=true]').each((_,el)=>{$(el).find('a[href],button,input,select,textarea,[tabindex]').each((_,node)=>{const target=$(node);if(!target.attr('data-migration-hidden-tabindex'))target.attr('data-migration-hidden-tabindex',target.attr('tabindex')??'absent');target.attr('tabindex','-1');});});
}
