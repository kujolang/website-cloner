import {normalizeComponentMarkup} from './component-markup.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Shared build-time registry. Only matched runtimes enter a compiled page.
// Input is the final authored HTML, so adding a component in a template and
// rebuilding the exported project does not require crawling the source again.
const descriptors=[
 {id:'product-ordering',selector:'form[data-cloner-product-ordering]',file:'component-product-ordering.js'},
 {id:'tooltip',selector:'[data-js~="tribe-events-tooltip"][data-tooltip-content],[data-migration-calendar]:has(.tribe-events-calendar-month)',file:'component-tooltip.js'},
 {id:'calendar',selector:'[data-migration-calendar]:has(.tribe-events-calendar-day),[data-migration-calendar]:has(.tribe-events-calendar-list),[data-migration-calendar]:has(.tribe-events-calendar-month)',file:'component-calendar.js'},
 {id:'addon-navigation',selector:'nav.hfe-nav-menu__layout-horizontal,nav.hfe-nav-menu__layout-vertical,nav.hfe-nav-menu__layout-expandible,nav.hfe-nav-menu__layout-flyout,.hfe-flyout-wrapper nav',file:'component-addon-navigation.js'},
 {id:'filter-grid',selector:'[data-migration-filter]',file:'component-filter-grid.js'},
 {id:'product-gallery',selector:'[data-cloner-product-gallery]',file:'component-product-gallery.js'},
 {id:'product-lightbox',selector:'[data-cloner-product-lightbox]',files:['vendor-photoswipe.js','vendor-photoswipe-ui.js','component-product-lightbox.js']},
 {id:'product-options',selector:'form[data-cloner-product-options]',file:'component-product-options.js'},
 {id:'inferred-menu',selector:'button[aria-haspopup="true"]:not([aria-controls]),button[aria-haspopup="menu"]:not([aria-controls])',file:'component-inferred-menu.js'},
 {id:'named-popup',selector:'button[data-dropdown-trigger][aria-haspopup]:not([aria-controls])',file:'component-named-popup.js'},
 {id:'named-drilldown',selector:'[role="menu"]:has([data-dropdown-name]):has([data-mobile-dropdown],[data-dropdown-target])',file:'component-named-drilldown.js'},
 {id:'responsive-details',selector:'details[open] > summary',file:'component-responsive-details.js'},
 {id:'details',selector:'[data-migration-details]',file:'component-details.js'},
 {id:'disclosure',selector:'[data-migration-disclosure]',file:'component-disclosure.js'},
 {id:'container-breakpoints',selector:'[data-migration-container-breakpoints]',file:'component-breakpoints.js'},
 {id:'consent',selector:'[data-cloner-consent-config]',file:'component-consent.js'},
 {id:'choices',selector:'[data-cloner-choices]',file:'component-choices.js'},
 {id:'input-mask',selector:'[data-cloner-input-mask]',files:['vendor-inputmask.js','component-input-mask.js']},
 {id:'forms',selector:'form[data-cloner-delivery]',file:'component-forms.js'},
 {id:'smart-slider',selector:'[data-cloner-smart-slider]',file:'component-smart-slider.js'},
 {id:'carousel',selector:'.e-n-carousel.swiper,.elementor-main-swiper',file:'component-carousel.js'},
 {id:'truncation',selector:'[data-migration-truncate-lines]',file:'component-truncation.js'},
 {id:'tabs',selector:'.elementor-tabs,.e-n-tabs,[data-migration-tabs]',file:'component-tabs.js'},
 {id:'accordion',selector:'.elementor-accordion,.elementor-toggle,[data-migration-accordion]',file:'component-accordion.js'},
];
const registry=await Promise.all(descriptors.map(async d=>{
 const source=(await Promise.all((d.files||[d.file]).map(file=>readFile(new URL('./'+file,import.meta.url),'utf8')))).join('\n;\n');
 return {...d,source,hash:'sha256-'+createHash('sha256').update(source).digest('base64')};
}));
// Preview trusts only runtime bytes shipped by this registry, never source markup.
export const componentScriptHashes=Object.freeze(registry.map(adapter=>adapter.hash));
export function applyComponents($){
 normalizeComponentMarkup($);
 const applied=[];
 for(const adapter of registry){
  if(!$(adapter.selector).length)continue;
  if(adapter.id==='named-popup'&&!$('[role="menu"][aria-hidden][data-dropdown-name]').length)continue;
  if(adapter.id==='inferred-menu'&&!$('[role="menu"][aria-hidden][aria-label]').length)continue;
  if(adapter.id==='responsive-details'&&!$(adapter.selector).filter((_,el)=>!$(el).closest('[data-migration-details],[data-migration-responsive-details="preserve"]').length).length)continue;
  // Always replace our prior script when rebuilding; never trust a source marker.
  $(`script[data-cloner-component="${adapter.id}"]`).remove();
  $('body').append(`<script data-cloner-component="${adapter.id}">${adapter.source}</script>`);
  const policy=$('meta[http-equiv]').filter((_,e)=>$(e).attr('http-equiv')?.toLowerCase()==='content-security-policy');
  policy.each((_,node)=>{
   const tag=$(node);let value=tag.attr('content')||'';
   for(const directive of ['script-src','script-src-elem']){
    const pattern=new RegExp('(^|;)(\\s*'+directive+'\\s+)([^;]*)','i');
    if(pattern.test(value))value=value.replace(pattern,(_,start,prefix,rules)=>start+prefix+rules.replace(/'none'\s*/g,'').trim()+(!rules.includes("'"+adapter.hash+"'")?" '"+adapter.hash+"'":''));
    else if(directive==='script-src')value+="; script-src '"+adapter.hash+"'";
   }
   tag.attr('content',value);
  });
  applied.push({id:adapter.id,bytes:Buffer.byteLength(adapter.source),hash:adapter.hash});
 }
 return applied;
}
