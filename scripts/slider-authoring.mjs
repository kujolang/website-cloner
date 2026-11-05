import {captureComponentMedia,renderComponentMedia} from './component-media.mjs';
import {load} from 'cheerio/slim';

// Stable public slide IDs bind both content and background tracks. Keeping this
// relationship explicit prevents authored ordering from separating their media.
function parts($,root){
 const own=(_,node)=>$(node).closest('[data-cloner-smart-slider]')[0]===root[0];
 return {slides:root.find('.n2-ss-slide[data-slide-public-id]').filter(own),backgrounds:root.find('.n2-ss-slide-background[data-public-id]').filter(own)};
}
export function captureSliderSequences($){
 const sequences=Object.create(null);
 $('[data-cloner-smart-slider][id]').each((_,node)=>{
  const root=$(node),{slides,backgrounds}=parts($,root),ids=slides.map((_,el)=>$(el).attr('data-slide-public-id')).get();
  if(!ids.length||new Set(ids).size!==ids.length||backgrounds.length!==ids.length)return;
  if(ids.some(id=>backgrounds.filter((_,el)=>$(el).attr('data-public-id')===id).length!==1))return;
  if(slides.toArray().some(el=>el.parent!==slides[0].parent)||backgrounds.toArray().some(el=>el.parent!==backgrounds[0].parent))return;
  sequences[root.attr('id')]=ids;
 });
 return sequences;
}
export function renderSliderSequences(html,sequences){
 if(sequences===undefined)return html;
 if(!sequences||typeof sequences!=='object'||Array.isArray(sequences))throw Error('Invalid slider_sequences frontmatter');
 const $=load(html,null,false),captured=captureSliderSequences($);let changed=false;
 for(const [id,items] of Object.entries(sequences)){
  const order=Array.isArray(items)?items.map(value=>typeof value==='string'?value:value?.id):[];
  if(!Array.isArray(items)||order.some(value=>typeof value!=='string'||!value)||new Set(order).size!==order.length)throw Error('Slider sequence must contain unique string IDs: '+id);
  const root=$('[data-cloner-smart-slider][id]').filter((_,el)=>$(el).attr('id')===id);
  if(root.length!==1)throw Error('Unknown or duplicate slider: '+id);
  const available=captured[id];
  if(!available)throw Error('Unsupported slider track structure: '+id);
  if(items.some(item=>typeof item==='string'&&!available.includes(item)))throw Error('Unknown slide in slider sequence: '+id);
  const additions=items.filter(item=>typeof item!=='string');
  for(const item of additions)if(!item||typeof item!=='object'||Array.isArray(item)||available.includes(item.id)||!available.includes(item.template)||typeof item.title!=='string'||typeof item.image?.src!=='string')throw Error('Invalid new slide definition: '+id);
  if(!additions.length&&JSON.stringify(order)===JSON.stringify(available))continue;
  changed=true;
  if(!order.length){root.remove();continue;}
  const {slides,backgrounds}=parts($,root);
  const reorder=(nodes,ordered)=>{const anchor=$('<span></span>');$(nodes[0]).before(anchor);$(nodes).remove();for(const node of ordered)anchor.before(node);anchor.remove();};
  const slideMap=new Map(slides.toArray().map(el=>[$(el).attr('data-slide-public-id'),el])),backgroundMap=new Map(backgrounds.toArray().map(el=>[$(el).attr('data-public-id'),el]));
  for(const item of additions){
   const slide=$(slideMap.get(item.template)).clone(),background=$(backgroundMap.get(item.template)).clone();
   if(slide.find('[id]').length||slide.attr('id')||background.find('[id]').length||background.attr('id')||slide.find('.n2-ss-layer[data-sstype=slide]').children().length)throw Error('New slide template requires layer/ID authoring support: '+item.template);
   const pictures=background.find('picture');if(pictures.length!==1)throw Error('New slide template requires one picture: '+item.template);
   const capturedMedia=captureComponentMedia($.html(pictures[0]));if(!capturedMedia)throw Error('Unsupported new slide media');
   if(capturedMedia.data.sources.length&&(!Array.isArray(item.sources)||item.sources.length!==capturedMedia.data.sources.length)||capturedMedia.data.image.srcset!==undefined&&item.image.srcset===undefined)throw Error('New slide requires explicit responsive candidates');
   const media={image:{...capturedMedia.data.image,...item.image},sources:item.sources??capturedMedia.data.sources};
   pictures.replaceWith(renderComponentMedia(capturedMedia.html,media));
   slide.attr('data-slide-public-id',item.id).attr('data-title',item.title).removeAttr('data-first');slide.find('.n2-ss-slide--focus').text(item.title);
   background.attr('data-public-id',item.id);background.find('[data-alt]').attr('data-alt',media.image.alt||'');
   slideMap.set(item.id,slide[0]);backgroundMap.set(item.id,background[0]);
  }
  order.forEach((key,index)=>{const slide=$(slideMap.get(key)),background=$(backgroundMap.get(key));slide.toggleClass('n2-ss-slide-active',index===0);if(index===0)slide.removeAttr('inert');else slide.attr('inert','');for(const el of [slide,background]){el.attr('aria-hidden',String(index!==0));if(index===0)el.removeAttr('hidden');else el.attr('hidden','');}});
  reorder(slides.toArray(),order.map(key=>slideMap.get(key)));reorder(backgrounds.toArray(),order.map(key=>backgroundMap.get(key)));
  const groups=new Map();root.find('[data-slide-public-id]').filter((_,el)=>!$(el).is('.n2-ss-slide')&&!$(el).closest('.n2-ss-slide').length&&$(el).closest('[data-cloner-smart-slider]')[0]===root[0]).each((_,el)=>{if(!groups.has(el.parent))groups.set(el.parent,[]);groups.get(el.parent).push(el);});
  for(const nodes of groups.values()){
   const candidates=[...nodes];for(const item of additions){const originals=nodes.filter(el=>$(el).attr('data-slide-public-id')===item.template);for(const original of originals){const clone=$(original).clone();if(clone.attr('id')||clone.find('[id]').length)throw Error('New slide control requires ID authoring support');clone.attr('data-slide-public-id',item.id).attr('aria-label',item.title);if(!clone.children().length)clone.text(item.title);clone.find('img').attr('src',item.image.src).attr('alt',item.image.alt||'').removeAttr('srcset');candidates.push(clone[0]);}}
   const selected=candidates.filter(el=>order.includes($(el).attr('data-slide-public-id'))).sort((a,b)=>order.indexOf($(a).attr('data-slide-public-id'))-order.indexOf($(b).attr('data-slide-public-id')));for(const node of selected)$(node).attr('aria-selected',String($(node).attr('data-slide-public-id')===order[0]));reorder(nodes,selected);}

 }
 return changed?$.html():html;
}
