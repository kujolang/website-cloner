import {load} from 'cheerio/slim';

// Inspect rendered structures, not global plugin assets: a stylesheet installed
// on every route does not mean every route exercises its widgets.
export function componentCoverage(page){
 const html=page.sourceHTML||[page.header,page.content,page.footer].filter(Boolean).join('\n');
 if(!html||!/(?:data-widget_type|n2-ss-slider|wpcf7|wpforms|eael-|uagb-|wc-block|woocommerce|tribe-events|wp-block-navigation|<details|<form)/i.test(html))return [];
 const $=load(html,null,false),keys=new Set();
 $('[data-widget_type]').each((_,node)=>{
  const widget=$(node),type=widget.attr('data-widget_type');if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(type||''))return;
  const variants=new Set();widget.find('[class]').addBack('[class]').each((_,el)=>{for(const name of ($(el).attr('class')||'').split(/\s+/))if(/^(?:hfe-nav-menu__layout-|eael-tabs-|eael-adv-tabs-|eael-filter-gallery-)(?:horizontal|vertical|expandible|flyout|grid|masonry)$/.test(name))variants.add(name);});
  if(widget.find('nav[data-full-width="yes"]').length)variants.add('full-width');
  widget.find('.hfe-side[data-layout]').each((_,el)=>{const side=$(el).attr('data-layout'),effect=$(el).attr('data-flyout-type');if(['left','right'].includes(side))variants.add('side-'+side);if(['normal','push'].includes(effect))variants.add('effect-'+effect);});
  let depth=0;widget.find('nav ul').each((_,el)=>{depth=Math.max(depth,$(el).parentsUntil(widget[0],'ul').length+1);});if(depth)variants.add('depth-'+depth);
  const chrome=widget.parents('header,footer').filter((_,el)=>!$(el).parents('main,article').length).first()[0]?.name;
  keys.add('widget:'+type+'@'+(chrome||'content')+(variants.size?':'+[...variants].sort().join('+'):''));
 });
 for(const [key,selector] of [
  ['slider:smart','.n2-ss-slider'],['forms:cf7','.wpcf7'],['forms:wpforms','.wpforms-container'],
  ['gallery:filter','.eael-filter-gallery-wrapper'],['accordion:spectra','.wp-block-uagb-faq'],
  ['commerce:variations','form.variations_form'],['commerce:gallery','.woocommerce-product-gallery'],
  ['commerce:cart','.wc-block-cart'],['events:listing','.tribe-events-view'],
  ['navigation:core','.wp-block-navigation'],['disclosure:native','details'],['forms:public','form']
 ])if($(selector).length)keys.add(key);
 return [...keys].sort();
}
