import {publicFormContracts} from './form-contract.mjs';
import {load} from 'cheerio';

// Detection is evidence, never a claim that a plugin's complete behavior works.
// These descriptors run during generation only; none ships as visitor JavaScript.
export const platformTargets = Object.freeze([
  {id:'elementor',name:'Elementor / Pro',slugs:['elementor','elementor-pro'],selectors:['[data-elementor-type]','[data-elementor-id]'],capabilities:['layout','navigation','carousel','dialog','form','motion']},
  {id:'woocommerce',name:'WooCommerce',slugs:['woocommerce'],selectors:['.woocommerce','.wc-block-grid','.wc-block-cart'],capabilities:['products','taxonomy','gallery','commerce'],connection:'Checkout, payments, inventory and accounts require a configured commerce backend.'},
  {id:'contact-form-7',name:'Contact Form 7',slugs:['contact-form-7'],selectors:['.wpcf7'],capabilities:['form'],connection:'Message delivery and spam protection require a configured form service.'},
  {id:'wpforms',name:'WPForms',slugs:['wpforms-lite','wpforms'],selectors:['.wpforms-container'],capabilities:['form'],connection:'Message delivery, uploads and server validation require a configured form service.'},
  {id:'yoast',name:'Yoast SEO',slugs:['wordpress-seo','wordpress-seo-premium'],selectors:['script.yoast-schema-graph'],capabilities:['seo'],comments:[/optimized with the Yoast SEO plugin/i]},
  {id:'rank-math',name:'Rank Math',slugs:['seo-by-rank-math','seo-by-rank-math-pro'],selectors:['script.rank-math-schema'],capabilities:['seo'],comments:[/Search Engine Optimization by Rank Math/i]},
  {id:'aioseo',name:'All in One SEO',slugs:['all-in-one-seo-pack'],selectors:['script.aioseo-schema'],capabilities:['seo'],comments:[/All in One SEO\s[\d.]+/i]},
  {id:'acf',name:'Advanced Custom Fields',slugs:['advanced-custom-fields','advanced-custom-fields-pro'],selectors:[],capabilities:['fields','collections'],limitation:'Private field schemas and unexposed values cannot be recovered from public HTML.'},
  {id:'cpt-ui',name:'Custom Post Type UI',slugs:['custom-post-type-ui'],selectors:[],capabilities:['collections','taxonomy'],limitation:'Public type discovery does not establish which plugin registered that type.'},
  {id:'litespeed',name:'LiteSpeed Cache',slugs:['litespeed-cache'],selectors:['[data-litespeed-src]'],capabilities:['assets'],comments:[/Page (?:optimized|cached) by LiteSpeed Cache/i]},
  {id:'wp-rocket',name:'WP Rocket',slugs:['wp-rocket'],selectors:['script[type="rocketlazyloadscript"]','[data-rocket-lazyload]'],capabilities:['assets'],comments:[/Performance optimized by WP Rocket/i]},
  {id:'autoptimize',name:'Autoptimize',slugs:['autoptimize'],selectors:[],capabilities:['assets'],assetPaths:[/\/cache\/autoptimize\//i]},
  {id:'essential-addons',name:'Essential Addons for Elementor',slugs:['essential-addons-for-elementor-lite','essential-addons-elementor'],selectors:['[class^="eael-"]','[class*=" eael-"]'],capabilities:['navigation','carousel','tabs','gallery','filter']},
  {id:'ultimate-addons',name:'Ultimate Addons for Elementor',slugs:['header-footer-elementor','ultimate-elementor'],selectors:['[class^="uael-"]','[class*=" uael-"]','[class^="hfe-"]','[class*=" hfe-"]'],capabilities:['layout','navigation','carousel','tabs']},
  {id:'spectra',name:'Spectra',slugs:['ultimate-addons-for-gutenberg'],selectors:['[class^="wp-block-uagb-"]','[class*=" wp-block-uagb-"]'],capabilities:['layout','accordion','icons']},
  {id:'smart-slider',name:'Smart Slider 3',slugs:['smart-slider-3'],selectors:['.n2-ss-slider'],capabilities:['carousel','motion']},
  {id:'complianz',name:'Complianz',slugs:['complianz-gdpr','complianz-gdpr-premium'],selectors:['.cmplz-cookiebanner'],capabilities:['consent'],connection:'Consent must govern the services enabled in the export, not stale source integrations.'},
  {id:'cookieyes',name:'CookieYes',slugs:['cookie-law-info'],selectors:['.cky-consent-container'],capabilities:['consent'],connection:'Consent must govern the services enabled in the export, not stale source integrations.'},
  {id:'redirection',name:'Redirection',slugs:['redirection'],selectors:[],capabilities:['redirects'],limitation:'Hidden redirect rules require an owner-supplied export; only encountered redirects are observable.'},
  {id:'events-calendar',name:'The Events Calendar',slugs:['the-events-calendar','events-calendar-pro'],selectors:['.tribe-events','[class^="tribe-events-"]','[class*=" tribe-events-"]'],capabilities:['events','collections'],limitation:'Private recurrence rules and booking services cannot be inferred from a displayed event.'},
]);

function commentsIn($){
  const values=[];
  const visit=nodes=>{for(const node of nodes){if(node.type==='comment')values.push(node.data);if(node.children)visit(node.children);}};
  visit($.root()[0].children);
  return values;
}

export function inspectPlatformPage(page){
  const html=page.sourceHTML || [page.header,page.content,page.footer].filter(Boolean).join('\n');
  const $=load(html || '');
  const assets=[];
  $('script[src],link[href]').each((_,el)=>{
    try{assets.push(new URL($(el).attr('src')||$(el).attr('href'),page.url||'https://invalid.example/').pathname);}catch{}
  });
  const comments=commentsIn($);
  const detected=[];
  for(const target of platformTargets){
    const evidence=[];
    for(const selector of target.selectors)if($(selector).length)evidence.push({kind:'markup',selector});
    for(const slug of target.slugs)if(assets.some(p=>p.includes('/plugins/'+slug+'/')))evidence.push({kind:'plugin-asset',slug});
    for(const pattern of target.comments||[])if(comments.some(c=>pattern.test(c)))evidence.push({kind:'generator-comment'});
    for(const pattern of target.assetPaths||[])if(assets.some(p=>pattern.test(p)))evidence.push({kind:'optimized-asset'});
    if(evidence.length)detected.push({id:target.id,evidence});
  }
  return {route:page.route,detected,forms:page.sourceForms||publicFormContracts($,page.route)};
}

export function platformSupportReport(pages){
  const inspected=pages.map(inspectPlatformPage);
  const detectedIds=new Set(inspected.flatMap(p=>p.detected.map(d=>d.id)));
  return {
    schema:'website-cloner-platform-support/v1',
    detectionPolicy:'Public markup and resource evidence only. Not detected does not mean absent. Detection does not verify compatibility.',
    pages:inspected,
    plugins:platformTargets.filter(t=>detectedIds.has(t.id)).map(t=>({
      id:t.id,name:t.name,capabilities:t.capabilities,
      status:'unverified',
      ...(t.connection?{requiredConnection:t.connection}:{}),
      ...(t.limitation?{limitation:t.limitation}:{}),
      routes:inspected.filter(p=>p.detected.some(d=>d.id===t.id)).map(p=>p.route),
    })),
  };
}
