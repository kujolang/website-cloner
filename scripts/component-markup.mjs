// Normalize published component contracts without changing their layout or CSS.
export function normalizeComponentMarkup($){
 // Inert, allowlisted icon templates preserve addon open/close artwork without
 // inserting source-provided HTML into the browser at interaction time.
 $('nav.hfe-nav-menu__layout-horizontal,nav.hfe-nav-menu__layout-vertical,nav.hfe-nav-menu__layout-expandible,nav.hfe-nav-menu__layout-flyout,.hfe-flyout-wrapper nav').each((_,node)=>{
  const nav=$(node),parent=nav.parent();nav.find('.hfe-has-submenu-container').each((_,el)=>{if($(el).next().is('ul.sub-menu'))$(el).parent().addClass('parent-has-child');});parent.children('template[data-cloner-menu-icon]').remove();
  const tags=new Set(['svg','path','g','rect','circle','ellipse','line','polyline','polygon','i','span']);
  const attrs=new Set(['class','viewbox','xmlns','d','fill','fill-rule','stroke','stroke-width','stroke-linecap','stroke-linejoin','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','points','transform']);
  for(const name of ['toggle','close']){const raw=nav.attr('data-'+name+'-icon');if(!raw||raw.length>65536)continue;const wrapper=$('<div></div>').html(raw);
   wrapper.find('*').each((_,el)=>{if(!tags.has(el.name)){ $(el).remove();return;}for(const [key,value] of Object.entries(el.attribs||{}))if(!attrs.has(key.toLowerCase())||/url\s*\(|javascript:/i.test(value))$(el).removeAttr(key);});
   if(!wrapper.children().length)continue;wrapper.children().attr('aria-hidden','true');const template=$('<template></template>').attr('data-cloner-menu-icon',name);template.append(wrapper.contents());parent.append(template);
  }
 });

 $('[data-migration-filter-ready]').removeAttr('data-migration-filter-ready');
 $('.eael-filter-gallery-wrapper').each((_,node)=>{
  const root=$(node),items=root.find('.eael-filter-gallery-container.eael-filter-gallery-grid,.eael-filter-gallery-container.masonry').filter((_,el)=>$(el).closest('.eael-filter-gallery-wrapper')[0]===node).first(),cards=items.children('.eael-filterable-gallery-item-wrap');
  if(!items.length||!cards.length||Number(items.attr('data-total-gallery-items'))!==cards.length)return;
  const controls=root.find('[data-filter]').filter((_,el)=>$(el).closest('.eael-filter-gallery-wrapper')[0]===node);
  if(!controls.length||controls.toArray().some(el=>! /^(?:\*|\.[\p{L}_][\p{L}\p{N}_-]*)$/u.test($(el).attr('data-filter')||'')))return;
  root.attr('data-migration-filter','').attr('data-migration-filter-layout',items.hasClass('masonry')?'masonry':'grid');items.attr('data-migration-filter-items','').removeAttr('data-gallery-items').removeAttr('data-settings');cards.attr('data-migration-filter-item','');
  root.find('form.fg-layout-3-search-box').filter((_,el)=>$(el).closest('.eael-filter-gallery-wrapper')[0]===node).each((_,el)=>{
   const form=$(el);form.attr('data-migration-filter-form','').removeAttr('action').removeAttr('method');
   form.find('input[name="fg-frontend-search"]').attr('data-migration-filter-search','');
  });
  const empty=root.find('[id="eael-fg-no-items-found"]');empty.attr('data-migration-filter-empty','');if(empty.length)root.attr('data-migration-filter-empty-spacing','2');
  root.find('[id="fg-filter-trigger"]').attr('data-migration-filter-toggle','');
  root.find('.fg-layout-3-filter-controls').attr('data-migration-filter-menu','');
  if(items.attr('data-migration-filter-initial')!==undefined)root.find('.eael-gallery-load-more').attr('data-migration-filter-more','');
  controls.each((_,el)=>{const control=$(el);control.attr('data-migration-filter-value',control.attr('data-filter').replace(/^\./,'')).attr('aria-pressed',String(control.hasClass('active')));});
 });
 $('[data-migration-tabs-ready]').removeAttr('data-migration-tabs-ready');
 $('[data-migration-accordion-ready]').removeAttr('data-migration-accordion-ready');
 $('.woocommerce-tabs').each((_,node)=>{
  const root=$(node);root.attr('data-migration-tabs','').attr('data-migration-active-class','active');
  root.find('.wc-tabs [role=tab]').filter((_,el)=>$(el).closest('.woocommerce-tabs')[0]===node).each((_,el)=>{const control=$(el),item=control.closest('li');item.attr('data-migration-tab-item','');control.attr('aria-selected',String(item.hasClass('active')));});
 });
 const detailsRoots=$('.e-n-accordion');
 detailsRoots.each((_,node)=>{
  const root=$(node);let settings={};
  try{settings=JSON.parse(root.closest('[data-settings]').attr('data-settings')||'{}');}catch{}
  if(!settings||typeof settings!=='object')settings={};
  const timing=settings.n_accordion_animation_duration;
  if(timing&&Number.isFinite(Number(timing.size))&&Number(timing.size)>=0&&['ms','s'].includes(timing.unit)&&root.attr('data-migration-details-duration')===undefined)root.attr('data-migration-details-duration',String(Number(timing.size)*(timing.unit==='s'?1000:1)));
  if(!root.attr('data-migration-details'))root.attr('data-migration-details',settings.max_items_expended==='multiple'?'multiple':'single');
 });
 const disclosures=$('.tribe-events-c-subscribe-dropdown'),searchBars=$('.tribe-events-c-events-bar'),viewSelectors=$('.tribe-events-c-view-selector');
 const tabRoots=$('.eael-advance-tabs'),faqRoots=$('.wp-block-uagb-faq.uagb-faq-layout-accordion');
 if(!tabRoots.length&&!faqRoots.length&&!disclosures.length&&!searchBars.length&&!viewSelectors.length)return;
 const ids=new Set($('[id]').map((_,el)=>$(el).attr('id')).get());let serial=0;
 const identify=(el,prefix)=>{if(el.attr('id'))return el.attr('id');let id;do{id='cloner-'+prefix+'-'+(++serial);}while(ids.has(id));ids.add(id);el.attr('id',id);return id;};
 viewSelectors.each((_,node)=>{
  const root=$(node),button=root.children('.tribe-events-c-view-selector__button'),panel=root.children('.tribe-events-c-view-selector__content');if(button.length!==1||panel.length!==1)return;
  if(panel.attr('id')&&$('[id]').filter((_,el)=>$(el).attr('id')===panel.attr('id')).length>1)panel.removeAttr('id');
  root.attr('data-migration-disclosure','').attr('data-migration-disclosure-responsive','button');button.attr('data-migration-disclosure-button','').attr('aria-controls',identify(panel,'calendar-views')).attr('aria-expanded','false').attr('data-migration-disclosure-open-class','tribe-events-c-view-selector__button--active');panel.attr('data-migration-disclosure-panel','');
 });
 searchBars.each((_,node)=>{
  const root=$(node),button=root.children('.tribe-events-c-events-bar__search-button'),panel=root.children('.tribe-events-c-events-bar__search-container');if(button.length!==1||panel.length!==1)return;
  if(panel.attr('id')&&$('[id]').filter((_,el)=>$(el).attr('id')===panel.attr('id')).length>1)panel.removeAttr('id');
  root.attr('data-migration-disclosure','').attr('data-migration-disclosure-responsive','button').attr('data-migration-disclosure-focus','true');button.attr('data-migration-disclosure-button','').attr('aria-controls',identify(panel,'event-search')).attr('aria-expanded','false').attr('data-migration-disclosure-open-class','tribe-events-c-events-bar__search-button--active');panel.attr('data-migration-disclosure-panel','');
 });
 disclosures.each((_,node)=>{
  const root=$(node),button=root.find('.tribe-events-c-subscribe-dropdown__button-text').first(),panel=root.find('.tribe-events-c-subscribe-dropdown__content').first();if(!button.length||!panel.length)return;
  const old=panel.attr('id');if(old&&$('[id]').filter((_,el)=>$(el).attr('id')===old).length>1)panel.removeAttr('id');
  root.attr('data-migration-disclosure','');button.attr('data-migration-disclosure-button','').attr('aria-controls',identify(panel,'disclosure')).attr('aria-expanded','false');panel.attr('data-migration-disclosure-panel','');
  root.find('.tribe-events-c-subscribe-dropdown__button').first().attr('data-migration-disclosure-trigger','').attr('data-migration-disclosure-open-class','tribe-events-c-subscribe-dropdown__button--active');
  root.find('.tribe-events-c-subscribe-dropdown__button-icon').attr('data-migration-disclosure-open-class','tribe-events-c-subscribe-dropdown__button-icon--rotate');
 });
 tabRoots.each((_,node)=>{
  const root=$(node);root.attr('data-migration-tabs','').attr('data-migration-active-class','active').attr('data-migration-inactive-class','inactive');
  if(root.hasClass('eael-tab-toggle'))root.attr('data-migration-tabs-collapsible','true');
  if(!root.hasClass('eael-tab-auto-active'))root.attr('data-migration-tabs-initial','none');
  const panels=root.find('.eael-tab-content-item').filter((_,el)=>$(el).closest('.eael-advance-tabs')[0]===node);
  const controls=root.find('.eael-tab-item-trigger,[role=tab]').filter((_,el)=>$(el).closest('.eael-advance-tabs')[0]===node);
  panels.attr('role','tabpanel');
  const hasActive=controls.toArray().some(el=>$(el).hasClass('active'));
  controls.each((_,el)=>{const control=$(el),id=control.attr('aria-controls');const panel=panels.filter((_,p)=>$(p).attr('id')===id);if(panel.length!==1)return;
   const active=hasActive?control.hasClass('active'):control.hasClass('active-default');control.attr('role','tab').attr('aria-selected',String(active));panel.attr('aria-labelledby',identify(control,'tab'));
  });
 });
 faqRoots.each((_,node)=>{
  const root=$(node);root.attr('data-migration-accordion',root.attr('data-faqtoggle')==='false'?'multiple':'single').attr('data-migration-active-class','uagb-faq-item-active').attr('data-migration-accordion-duration','500');
  const items=root.find('.uagb-faq-item').filter((_,el)=>$(el).closest('.wp-block-uagb-faq')[0]===node);
  const hasActive=items.toArray().some(el=>$(el).hasClass('uagb-faq-item-active')||$(el).attr('aria-expanded')==='true');
  items.each((index,el)=>{const item=$(el),control=item.find('.uagb-faq-questions-button').filter((_,c)=>$(c).closest('.uagb-faq-item')[0]===el).first(),panel=item.find('.uagb-faq-content').filter((_,p)=>$(p).closest('.uagb-faq-item')[0]===el).first();if(!control.length||!panel.length)return;
   const open=item.hasClass('uagb-faq-item-active')||item.attr('aria-expanded')==='true'||(!hasActive&&(root.hasClass('uagb-faq-inactive-other-false')||(index===0&&root.hasClass('uagb-faq-expand-first-true'))));
   item.attr('data-migration-accordion-item','').removeAttr('tabindex').removeAttr('role').removeAttr('aria-expanded');
   control.attr('aria-controls',identify(panel,'faq-panel')).attr('aria-expanded',String(open));panel.attr('role','region').attr('aria-labelledby',identify(control,'faq-title'));
  });
 });
}
