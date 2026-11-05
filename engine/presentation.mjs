import {restoreFormValidation} from './form-validation.mjs';
import {load} from 'cheerio';
import {extract,clean} from './extract.mjs';
// Compare equivalent sanitized fragments by structural position, including
// unstyled elements. Class-only matching can copy footer styles into a header.
export function restorePresentation(page, html) {
 const source=extract(html,page.documentURL||page.url||'https://example.invalid/');let restored=restoreSearchWrappers(page,html);
 for(const field of ['content','shell','header','footer']){
  if(!page[field]||!source[field])continue;const $=load(page[field],null,false),original=load(source[field],null,false);
  const visit=(nodes,others)=>{for(let i=0;i<nodes.length;i++){
   const el=nodes[i],other=others[i];if(!other||el.tagName!==other.tagName)continue;
   const node=$(el),ref=original(other);
   if((node.attr('id')||'')!==(ref.attr('id')||'')||(node.attr('class')||'')!==(ref.attr('class')||''))continue;
   // Do not transplant styles from a different revision's text or card.
   if(!node.children().length&&node.text().trim()!==ref.text().trim())continue;
   if(['input','textarea','select','option','button'].includes(el.tagName)){
    for(const key of ['type','name','value','required','multiple','aria-controls','aria-expanded','role']){const value=ref.attr(key);value===undefined?node.removeAttr(key):node.attr(key,value);}
   }
   if(ref.attr('hide')!==undefined)node.attr('hide',ref.attr('hide'));
   const style=ref.attr('style');if((node.attr('style')||'')!==(style||'')){style?node.attr('style',style):node.removeAttr('style');restored++;}
   visit(node.children().toArray(),ref.children().toArray());
  }};
  visit($.root().children().toArray(),original.root().children().toArray());$('[data-migration-search]').each((_,form)=>{const f=$(form);f.find('.e-search-loader,.e-search-input-wrapper > svg.e-fas-times,.e-search-results').remove();f.find('input').removeAttr('aria-controls').removeAttr('aria-expanded').removeAttr('role');f.find('button[type=button]').attr('type','submit');});page[field]=$.html();
 }
 // Main wrapper declarations are stored separately by fallback layouts.
 if(source.mainId===page.mainId&&source.mainClass===page.mainClass)page.mainStyle=source.mainStyle;
 page.cachedStyles=Object.fromEntries((page.styleSources||[]).map((entry,i)=>[JSON.stringify(entry),page.styles?.[i]]).filter(([,value])=>value));
 if(!page.hydratedStyles){page.styleSources=source.styleSources;page.css=source.css;}
 return restored;
}

// Older sanitizers unwrapped the HTML search landmark, breaking descendant CSS.
// Restore only that container; keep localized form content and URLs untouched.
export function restoreSearchWrappers(page,html){
 const source=load(html),wrappers=source('search').toArray();if(!wrappers.length)return 0;let restored=0;
 for(const field of ['content','shell','header','footer']){
  if(!page[field])continue;const $=load(page[field],null,false);
  $('[data-migration-search]').each((index,form)=>{
   if($(form).closest('search').length)return;
   const id=$(form).attr('id'),classes=($(form).attr('class')||'').split(/\s+/).filter(Boolean);
   const wrapper=wrappers.find(w=>source(w).find('form').toArray().some(f=>id?source(f).attr('id')===id:classes.length&&classes.every(c=>source(f).hasClass(c))));
   if(!wrapper)return;const copy=source(wrapper).clone().empty();if(copy.hasClass('e-search'))copy.removeClass('hidden');
   $(form).wrap(clean(copy.toString(),{forms:true}));restored++;
  });
  for(const wrapper of wrappers){
   if(source(wrapper).find('form').length)continue;
   const children=source(wrapper).children().toArray();if(!children.length)continue;
   const matches=(node,ref)=>node?.tagName===ref.tagName&&($(node).attr('id')||'')===(source(ref).attr('id')||'')&&($(node).attr('class')||'')===(source(ref).attr('class')||'')&&$(node).text().trim()===source(ref).text().trim();
   for(const first of $(children[0].tagName).toArray()){
    if($(first).closest('search').length||!matches(first,children[0]))continue;
    const siblings=[first,...$(first).nextAll().toArray()].slice(0,children.length);
    if(siblings.length!==children.length||!siblings.every((node,i)=>matches(node,children[i])))continue;
    $(siblings).wrapAll(clean(source(wrapper).clone().empty().toString(),{forms:true}));restored++;
   }
  }
  page[field]=$.html();
 }return restored;
}

// Parser upgrades start from the saved document rather than merging raw styles
// into already localized DOM, which can remove gallery URLs or reveal hidden UI.
export function refreshPresentation(page,html){
 const source=extract(html,page.documentURL||page.url);
 restoreFormValidation(page.sourceForms,source.sourceForms);
 const formNotice='Form submission needs a replacement service; appearance retained with disabled controls';
 page.dynamic=[...new Set([...(page.dynamic||[]).filter(value=>value!==formNotice&&!value.startsWith('Gallery payload:')),...source.dynamic.filter(value=>value===formNotice||value.startsWith('Gallery payload:'))])];
 page.cachedStyles=Object.fromEntries((page.styleSources||[]).map((entry,i)=>[JSON.stringify(entry),page.styles?.[i]]).filter(([,value])=>value));
 for(const key of ['sourceForms','sourceSEO','sourceContentText','sourceSemanticText','sourceArticleCount','content','shell','header','footer','mainId','mainClass','mainStyle','wrapperClass','bodyClass','blocks','text'])page[key]=source[key];
 if(!page.hydratedStyles){page.styleSources=source.styleSources;page.css=source.css;page.inlineCss=source.inlineCss;}
 delete page.assetCheckpointVersion;return 1;
}
