import {load} from 'cheerio/slim';
const origin=record=>{try{return new URL(record.source).origin;}catch{return null;}};
const theme=record=>(record.bodyClass||'').split(/\s+/).filter(c=>/^(wp-theme-|theme-)/.test(c)).sort().join(' ');
const shape=html=>{const $=load(html,null,false);return $('*').toArray().map(el=>el.name+'.'+($(el).attr('class')||'').split(/\s+/).filter(c=>c&&!/^(post-\d+|product_cat-|category-|tag-)/.test(c)&&!['first','last','instock','outofstock','sale','purchasable'].includes(c)).sort().join('.')+'['+($(el).attr('style')||'')+']').join('/');};
// Borrow only from the same evidenced taxonomy and site/theme, with a single
// compatible card/container shape. Ambiguous layouts retain the reported fallback.
export function inheritedArchivePresentation(binding,bindings,records){
 if(binding.mode!=='native'||!binding.filter?.taxonomy)return null;
 const target=records.get(binding.source);if(!target?.fragment)return null;
 const $=load(target.fragment,null,false);
 if(!$('[data-migration-empty-archive="'+binding.id+'"]').length)return null;
 const candidates=[];
 for(const donor of bindings){
  if(donor.mode==='native'||donor.page!==1||donor.rootContainer||donor.filter?.taxonomy!==binding.filter.taxonomy||!donor.template||!donor.sample||donor.source===binding.source)continue;
  const record=records.get(donor.source);if(!record?.fragment||!origin(target)||origin(record)!==origin(target)||theme(record)!==theme(target))continue;
  const doc=load(record.fragment,null,false),container=doc('[data-migration-archive="'+donor.id+'"]');
  if(container.length!==1||container.attr('id')||container.find('[data-migration-record]').length===0)continue;
  const shell=container.clone().empty().removeAttr('data-migration-archive');
  // A labelled/reference-bearing container may depend on source-only context.
  if(Object.keys(shell[0].attribs||{}).some(a=>!['class','style','role'].includes(a)))continue;
  const controls=[];let sibling=container.prev();
  while(sibling.length&&sibling.is('.woocommerce-result-count,.woocommerce-ordering')){controls.unshift(doc.html(sibling));sibling=sibling.prev();}
  const beforeHTML=controls.join(''),controlShape=load(beforeHTML,null,false);controlShape('.woocommerce-result-count').text('COUNT');controlShape('[data-migration-form-key]').removeAttr('data-migration-form-key');
  const containerHTML=doc.html(shell),signature=containerHTML+'\n'+shape(donor.template)+'\n'+controlShape.html();
  candidates.push({donor,containerHTML,beforeHTML,signature});
 }
 if(!candidates.length)return null;
 if(new Set(candidates.map(c=>c.signature)).size!==1)return {issue:'Empty archive has conflicting source presentation candidates'};
 const chosen=candidates.sort((a,b)=>a.donor.root.localeCompare(b.donor.root))[0];
 return {template:chosen.donor.template,cards:chosen.donor.cards,sample:chosen.donor.sample,pageSize:chosen.donor.pageSize,containerHTML:chosen.containerHTML,beforeHTML:chosen.beforeHTML,source:chosen.donor.source};
}
