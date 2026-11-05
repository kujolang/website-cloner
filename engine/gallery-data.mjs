// Materialize declarative gallery items before the ordinary HTML/asset sanitizer.
// Never execute the original widget or retain its encoded HTML in the export.
export function captureGalleryItems($){
 const warnings=[];
 $('.eael-filter-gallery-wrapper').each((_,node)=>{
  const root=$(node),container=root.find('.eael-filter-gallery-container.eael-filter-gallery-grid,.eael-filter-gallery-container.masonry').filter((_,el)=>$(el).closest('.eael-filter-gallery-wrapper')[0]===node).first();
  const cards=container.children('.eael-filterable-gallery-item-wrap'),total=Number(container.attr('data-total-gallery-items'));
  if(!cards.length||!Number.isSafeInteger(total)||total<=cards.length)return;
  const reject=reason=>warnings.push('Gallery payload: '+reason+'; unloaded items remain unsupported');
  if(container.attr('data-is-randomize')==='yes'){reject('randomized item order');return;}
  const encoded=container.attr('data-gallery-items')||'';
  if(encoded.length>8*1024*1024||!encoded.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)){reject('invalid or oversized declarative data');return;}
  let items;try{items=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));}catch{reject('invalid declarative JSON');return;}
  if(!Array.isArray(items)||items.length!==total||items.some(item=>typeof item!=='string')){reject('incomplete item definitions');return;}
  const parsed=items.map(html=>$(html));
  if(parsed.some(nodes=>nodes.length!==1||!nodes.is('div.eael-filterable-gallery-item-wrap'))){reject('unsupported item markup');return;}
  const initial=Number(container.attr('data-init-show')),batch=Number(container.attr('data-images-per-page'));
  if(!Number.isSafeInteger(initial)||initial<1||!Number.isSafeInteger(batch)||batch<1){reject('invalid pagination settings');return;}
  cards.remove();parsed.forEach((card,index)=>{card.attr('data-migration-filter-loaded',String(index<initial));if(index>=initial)card.attr('hidden','hidden');container.append(card);});
  container.attr('data-migration-filter-initial',String(Math.min(initial,total))).attr('data-migration-filter-batch',String(batch));
  if(container.attr('data-search-all')==='yes')container.attr('data-migration-filter-search-all','true');
 });
 return warnings;
}
