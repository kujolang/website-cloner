import {calendarDiscoveryLinks} from './calendar-crawl.mjs';
import {enrichForms} from './form-validation.mjs';
import {captureComponentData} from './component-data.mjs';
import {enrichEvents} from './events.mjs';
import {promoteDeferredAssets} from './deferred-assets.mjs';
import {discoverProducts} from './commerce.mjs';
import {captureSEO} from '../scripts/seo-export.mjs';
import {formKey,publicFormContracts,isLocalGallerySearch} from './form-contract.mjs';
import {markTruncation} from './truncation.mjs';
import {htmlMetadata} from './html-metadata.mjs';
import {contentText} from './content-text.mjs';
import { wordpressCatalog, discoverCustomFieldSchema, recordWordpress, mapWordpress, restURL } from './wordpress.mjs';
import { detectMotion } from './motion.mjs';
import { load } from "cheerio";
import sanitizeHtml from "sanitize-html";
import { svgTags, svgAttributes, safeSvgAttributes, svgStyles } from "./svg.mjs";
import { createHash } from "node:crypto";
export const hash = (x) => createHash("sha256").update(x).digest("hex");
export const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const plain = (html) => { const $ = load(html); $("style,script,noscript,template").remove(); return $.text().replace(/\s+/g, " ").trim(); };
export const staticQuery = u => [...u.searchParams].every(([key, value]) => (/^(p|page_id|paged|page|cpage|cat|query-\d+-page)$/.test(key) && /^[1-9]\d*$/.test(value)) || (/^(tag|category_name|post_type)$/.test(key) && /^[a-zA-Z0-9_-]{1,200}$/.test(value)));
export const pageRoute = url => { const u = new URL(url); u.searchParams.sort(); return u.search ? '/_migration/query/' + hash(u.pathname + u.search).slice(0,20) + '/' : u.pathname; };
export function clean(html, { forms = false } = {}) {
  return sanitizeHtml(html, {
    nonTextTags: ["script", "style", "textarea", "option", "template"],
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "picture",
      "migration-frame",
      "migration-script",
      "source",
      "figure",
      "center",
      "figcaption",
      "main",
      "header",
      "footer",
      "nav",
      "section",
      "search",
      "article",
      "details",
      "summary",
      "aside",
      "button",
      "time",
      "video",
      ...svgTags,
      ...(forms ? ["form", "input", "label", "textarea", "select", "option", "optgroup", "fieldset", "legend"] : []),
    ],
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    transformTags: { "*": safeSvgAttributes },
    // Inert platform layout flags participate in authored CSS selectors.
    // Keep these explicit; resource, form-action and event attributes remain excluded.
    allowedAttributes: {
      ...svgAttributes,
      "*": ["id", "class", "title", "aria-*", "data-*", "role", "style", "dir", "lang", "hidden", "hide", "tabindex", "inert", "dmtemplateid", "dmle_extension", "layout-main", "layout-sub", "list-layout", "has-shadow", "blog-posts-feature-flag", "freeheader"],
      a: ["href", "title"],
      img: ["src", "alt", "width", "height", "loading", "srcset", "sizes"],
      source: ["src", "srcset", "type", "media", "sizes"],
      time: ["datetime"],
      video: ["poster", "width", "height", "playsinline", "muted", "preload"],
      button: ["type", "disabled"],
      form: [],
      fieldset: ["disabled"],
      label: ["for"],
      input: ["type", "name", "placeholder", "value", "disabled", "required", "size", "maxlength", "minlength", "min", "max", "step", "pattern", "accept", "autocomplete", "multiple", "checked", "tabindex"],
      textarea: ["name", "required", "rows", "cols", "placeholder", "disabled", "maxlength", "minlength", "autocomplete"],
      select: ["name", "required", "multiple", "disabled"],
      option: ["value", "disabled", "selected", "label"],
      optgroup: ["label", "disabled"],
      details: ["open"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      ol: ["start", "reversed", "type"],
      li: ["value"],
    },
    allowedEmptyAttributes: ["value", "data-migration-source-description", "data-migration-source-describedby", "alt", "hidden", "disabled", "open", "reversed"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        ...svgStyles,
        // Custom properties carry responsive grid counts, spacing and theme
        // tokens. Admit safe values, never resource-loading or executable CSS.
        ...Object.fromEntries([...String(html).matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)].map(m=>[m[1],[/^(?!.*(?:url|expression|image-set|paint|attr)\s*\()[a-zA-Z0-9#.,% ()_+*\/-]+$/i]])),
        background: [/^(?!(?:.*(?:url|expression|image-set)\s*\())[#a-zA-Z0-9.,% ()_+*\/-]+$/i],
        "object-fit": [/^(fill|contain|cover|none|scale-down)$/],
        "object-position": [/^(?:(?:left|right|top|bottom|center|-?[\d.]+(?:%|px|em|rem)?)(?:\s+|$)){1,4}$/],
        ...Object.fromEntries(
          [
            "top", "right", "bottom", "left", "inset", "inset-inline-start", "inset-inline-end",
            "background-size", "background-position", "background-repeat", "background-origin", "background-clip",
            "transform", "transform-origin", "translate", "rotate", "scale",
            "z-index", "clip", "vertical-align", "text-shadow", "border", "border-top", "border-right", "border-bottom", "border-left",
            "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
            "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
            "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
            "padding",
            "padding-top",
            "padding-bottom",
            "padding-left",
            "padding-right",
            "margin",
            "margin-top",
            "margin-bottom",
            "margin-left",
            "margin-right",
            "font-size",
            "font-weight",
            "line-height",
            "letter-spacing",
            "gap",
            "row-gap",
            "column-gap",
            "width",
            "max-width",
            "min-height",
            "height",
            "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
            "border-width", "border-style", "border-color", "box-shadow",
            "flex-basis",
            "grid-template-columns", "grid-template-rows", "grid-auto-columns", "grid-auto-rows",
            "grid-column", "grid-row", "grid-column-gap", "grid-row-gap",
            "flex", "flex-grow", "flex-shrink", "order", "min-width",
            "aspect-ratio",
          ].map((k) => [k, [/^(?!.*(?:url|expression|image-set|paint|attr)\s*\()[a-zA-Z0-9#.,% ()_+*\/-]+$/i]]),
        ),
        "align-items": [/^(stretch|center|start|end|flex-start|flex-end|baseline)$/],
        "justify-content": [/^(normal|center|start|end|flex-start|flex-end|space-between|space-around|space-evenly)$/],
        "flex-direction": [/^(row|column|row-reverse|column-reverse)$/],
        "white-space": [/^(normal|nowrap|pre|pre-wrap|pre-line|break-spaces|inherit|initial|unset)$/],
        "font-style": [/^(normal|italic|oblique|inherit)$/],
        "text-transform": [/^(none|uppercase|lowercase|capitalize|inherit)$/],
        "overflow-x": [/^(hidden|visible|auto|scroll|clip)$/],
        "overflow-y": [/^(hidden|visible|auto|scroll|clip)$/],
        opacity: [/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/],
        display: [/^(initial|inherit|unset|revert|none|block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents|table|table-row|table-cell|list-item)$/],
        visibility: [/^(hidden|visible|collapse)$/],
        position: [/^(static|relative|absolute|fixed|sticky)$/],
        overflow: [/^(hidden|visible|auto|scroll|clip)$/],
        float: [/^(none|left|right)$/],
        clear: [/^(none|left|right|both)$/],
        "text-align": [/^(left|center|right)$/],
        color: [/^[a-z]+$/i, /^#[a-f\d]{3,8}$/i, /^rgba?\([\d., %]+\)$/, /^var\(--[a-zA-Z0-9_-]+(?:,\s*(?:#[a-f\d]{3,8}|rgba?\([\d., %]+\)|transparent|currentColor))?\)$/i],
        "background-color": [/^[a-z]+$/i, /^#[a-f\d]{3,8}$/i, /^rgba?\([\d., %]+\)$/],
      },
    },
  }).replace(/\{\{/g, "&#123;&#123;");
}
export function documentAttributes(html){const dom=load(html||'');return Object.fromEntries(['html','body'].map(tag=>[tag,{...Object.fromEntries(Object.entries(dom(tag)[0]?.attribs||{}).filter(([key])=>['id','dir'].includes(key)||tag==='html'&&key==='class'||/^data-[a-z0-9_-]+$/i.test(key))),style:load(clean('<div style="'+esc(dom(tag).attr('style')||'')+'"></div>'))('div').attr('style')||''}]));}
export function extract(html, url, rest) {
  const $ = load(html);
  const sourceSEO=captureSEO($);
  const componentWarnings=captureComponentData($);
  const sourceForms=publicFormContracts($,pageRoute(url));
  $('form').each((index,node)=>{const form=$(node);form.attr('data-migration-form-key',formKey(pageRoute(url),index,form.attr('id')||''));form.find('input,select,textarea,button').each((fieldIndex,control)=>$(control).attr('data-migration-field-index',String(fieldIndex)).attr('data-migration-source-disabled',$(control).is(':disabled')?'true':'false'));});
  promoteDeferredAssets($,url);
  const styleSources = [...$('link[rel=stylesheet],style')].flatMap(e => {
    const node=$(e);if(node.is('style'))return [{text:node.text(),media:node.attr('media')}];
    const value=node.attr('href')||node.attr('data-pmdelayedstyle')||node.attr('data-href');
    if(!value)return [];
    try {const target=new URL(value,url);return /^https?:$/.test(target.protocol)?[{url:target.href,media:node.attr('media')}]:[];}catch{return [];}
  });
  // Runtime and authored single-image backgrounds need the same checked asset
  // path as lazy backgrounds; never retain a remote URL in inline CSS.
  $('[style]').each((_,el)=>{
    const node=$(el),style=node.attr('style')||'';
    const match=/(?:^|;)\s*background-image\s*:\s*url\(\s*(["']?)([^"'()]+)\1\s*\)\s*(?:!important)?\s*(?:;|$)/i.exec(style);
    if(match&&!/[\\\x00-\x1f]/.test(match[2]))try{const u=new URL(match[2].trim(),url);if(['http:','https:'].includes(u.protocol))node.attr('data-background-image',u.href);}catch{}
  });
  markTruncation($);
  const title =
    $("head > title").first().text().trim() || plain(rest?.title?.rendered || "Untitled");
  const motion = detectMotion($);
  const dynamic = [...new Set([...componentWarnings,...motion.unsupported.map(x => `Motion: ${x.replace(/ \(SHA256 [a-f0-9]+\)/g, "")}`)])];
  for (const [selector, label] of [

    ["video", "Video playback omitted; available poster images retained"],
    [
      "[class*=woocommerce],a[href*=checkout],a[href*=cart]",
      "Commerce needs a replacement",
    ],
    ["a[href*=wp-login],input[type=password]", "Login or membership"],
    ["[class*=booking]", "Booking workflow"],
    ['script[src*=admin-ajax],script:contains("admin-ajax")', "WordPress AJAX"],

  ])
    if ($(selector).length) dynamic.push(label);
  $('iframe').each((_,el)=>{
    if($(el).closest('svg,template').length)return;
    const original=$(el),placeholder=$('<migration-frame></migration-frame>');
    for(const name of ['id','class','style','title','aria-label','hidden'])if(original.attr(name)!==undefined)placeholder.attr(name,original.attr(name));
    let dimensions='';for(const axis of ['width','height']){const value=original.attr(axis);if(value&&/^\d+(?:px|%)?$/.test(value))dimensions+='--migration-frame-'+axis+':'+value+(/\D$/.test(value)?'':'px')+';';}
    placeholder.attr('style',(placeholder.attr('style')||'')+';'+dimensions).attr('role','img');
    original.replaceWith(placeholder);
  });
  // Removing a non-rendering sibling changes :last-child/:nth-child rules.
  // Retain its structural position without source code, URLs or attributes.
  $('body script').each((_,el)=>{
    if($(el).closest('svg,template,noscript').length)return;
    $(el).replaceWith('<migration-script hidden="hidden" aria-hidden="true" style="display:none!important"></migration-script>');
  });
  $("script,noscript,template,iframe,object,embed,base,link[rel=preload],img[width=\"0\"][height=\"0\"]").remove();
  $('[data-migration-search],[data-migration-form-disabled]').removeAttr('data-migration-search').removeAttr('data-migration-form-disabled');
  $('form').each((i,e) => {
    const form = $(e), localGallery=isLocalGallerySearch($,form), search = (form.attr('method') || 'get').toLowerCase() === 'get' && (form.attr('role') === 'search' || form.find('input[type=search],input[name=s]').length);
    form.removeAttr('action').removeAttr('method').removeAttr('enctype');
    if(search)form.find('input[type=hidden]').remove();
    else form.find('input[type=hidden]').removeAttr('name').removeAttr('value').attr('disabled','disabled');
    form.find('input:not([type=submit]):not([type=checkbox]):not([type=radio]),textarea').removeAttr('value'); form.find('textarea').text('');
    if(localGallery){
      form.attr('data-migration-local-filter-form','true');
    } else if (search) {
      form.attr('data-migration-search', 'true').attr('role', 'search');
      form.find('button,input[type=submit]').attr('aria-label', 'Search local pages');
      form.find('.e-search-loader,.e-search-input-wrapper > svg.e-fas-times,.e-search-results').remove();
      form.find('input').removeAttr('aria-controls').removeAttr('aria-expanded').removeAttr('role');
    } else {
      form.attr('data-migration-form-disabled','true');
      form.find('input,textarea,select,button').attr('disabled','disabled');
      const notice='This form is unavailable until a replacement submission service is configured.';
      form.attr('data-migration-source-description',form.attr('aria-description')||'');
      const describedby=form.attr('aria-describedby')||'';
      const describedText=describedby.split(/\s+/).filter(Boolean).map(id=>$('[id]').filter((_,el)=>$(el).attr('id')===id).first().text().trim()).filter(Boolean).join(' ');
      form.attr('data-migration-source-describedby',describedby).removeAttr('aria-describedby');
      form.attr('aria-description',[notice,describedText||form.attr('data-migration-source-description')].filter(Boolean).join(' '));
      form.attr('title',[form.attr('title'),notice].filter(Boolean).join(' — '));
      dynamic.push('Form submission needs a replacement service; appearance retained with disabled controls');
    }
    form.find('*').addBack().each((j,node) => { for (const name of Object.keys(node.attribs || {})) if (name.startsWith('data-wp-')) $(node).removeAttr(name); });
  });
  $('.e-search.hidden').removeClass('hidden');
  const cleanPage = html => clean(html, { forms: true });
  // Select the site content container before an individual post. Classic
  // themes often use div#content and have twenty entry-content siblings.
  const main = ["main", '[role="main"]', "#content", ".site-content", "#main", "article", ".entry-content", "body"]
    .flatMap(selector=>$(selector).toArray().map(el=>$(el)))
    .find(element=>element.length&&!element.closest('[hidden],[aria-hidden="true"],[role="dialog"],dialog').length&&
      (plain(element.html()||"").trim().length>0||element.find('img,form,video').length)) || $('body');
  const sourceContentText = plain(main.html() || rest?.content?.rendered || "");
  const sourceArticleCount = main.find("article").length;
  const content = cleanPage(main.html() || rest?.content?.rendered || "");
  const shellDOM = load($.html());
  // Retain all ancestor IDs, wrappers, sidebar and sibling navigation.
  const mainPath = [];
  let cursor = main[0];
  while (cursor && cursor !== $("body")[0]) {
    mainPath.unshift($(cursor).parent().children().index(cursor));
    cursor = cursor.parent;
  }
  let shellMain = shellDOM("body");
  for (const index of mainPath) shellMain = shellMain.children().eq(index);
  shellMain.html("MIGRATION_CONTENT_SLOT_7c3e");
  shellDOM("style,link,meta").remove();
  const shell = cleanPage(shellDOM("body").html() || "MIGRATION_CONTENT_SLOT_7c3e");
  const wrapperClass = main.parents(".wp-site-blocks").length
    ? "wp-site-blocks"
    : main.parents("#page").length
      ? "site"
      : "";
  const header = cleanPage($("header").first().prop("outerHTML") || "");
  const footer = cleanPage($("footer").last().prop("outerHTML") || "");
  const family = $("body").hasClass("home")
    ? "home"
    : $("body").hasClass("single")
      ? "article"
      : $("body").hasClass("archive") || $("body").hasClass("blog")
        ? "archive"
        : "page";
  const safeMain = load(
    clean(main.clone().empty().prop("outerHTML") || "<main></main>"),
  );
  return {
    presentationVersion: 42,
    sourceSEO,
    sourceForms,
    documentAttributes: documentAttributes(html),
    sourceHTML: html,
    htmlMetadata: htmlMetadata(html,url),
    mainStyle: safeMain("main,article,div").first().attr("style") || "",
    wrapperClass,
    url,
    route: pageRoute(url),
    title,
    description: $("meta[name=description]").attr("content") || "",
    faviconSource: $('link[rel="icon"],link[rel="shortcut icon"]').first().attr("href") || "",
    lang: $("html").attr("lang") || "en",
    canonical: $("link[rel=canonical]").attr("href") || url,
    robots: $("meta[name=robots]").attr("content") || "",
    bodyClass: $("body").attr("class") || "",
    mainClass: main.attr("class") || "",
    mainId: main.attr("id") || "main-content",
    content,
    shell,
    sourceContentText,
    sourceSemanticText: contentText(main.html() || rest?.content?.rendered || ""),
    sourceArticleCount,
    blocks: [{ type: "html", html: content }],
    text: plain(content),
    header,
    footer,
    family,
    dynamic,
    motion,
    css: styleSources.filter(entry => entry.url).map(entry => entry.url),
    styleSources,
    inlineCss: [...$("style")].map((e) => $(e).text()),
    links: [...$("a[href]")]
      .map((e) => {
        try {
          return new URL($(e).attr("href"), url).href;
        } catch {
          return null;
        }
      })
      .filter(Boolean),
    navigation: [...$("nav a[href]")].slice(0, 30).map((e) => ({
      label: $(e).text().trim(),
      url: new URL($(e).attr("href"), url).href,
    })),
    provenance: {
      htmlSha256: hash(html),
      method: rest ? "wordpress-rest-and-html" : "html",
      capturedAt: new Date().toISOString(),
    },
  };
}
export function externalRedirectPage(url,destination){
 const target=new URL(destination);if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('Unsafe redirect target');
 const p=extract(`<html lang="en"><head><title>External link — ${esc(target.hostname)}</title><meta name="description" content="External link to ${esc(target.hostname)}"><meta name="robots" content="noindex,follow"></head><body><main><h1>External link</h1><p><a href="${esc(target.href)}">Continue to ${esc(target.hostname)}</a></p></main></body></html>`,url);
 p.redirectTarget=target.href;p.provenance.redirectVerified=true;return p;
}
export async function discover(source, network, { maxPages = null, sampleUrls = null, onEvent = () => {}, state = null, onCheckpoint = async () => {} } = {}) {
  // Explicit samples bound both enumeration and page capture. Uncapped migrations
  // drain the complete REST, sitemap and same-site link frontier.
  let sample=null;
  if(sampleUrls!==null){
   if(!Array.isArray(sampleUrls)||!sampleUrls.length||sampleUrls.length>10000)throw Error('Sample URLs must be a nonempty list of at most 10000 URLs');
   sample=new Set(sampleUrls.map(value=>{const u=new URL(value,source);if(u.origin!==new URL(source).origin||u.username||u.password||u.hash)throw Error('Sample URLs must be same-origin without credentials or fragments');return u.href;}));
   maxPages=sample.size;
  }
  const landing = await network.get(source);
  if (landing.status !== 200) throw Error(`Website returned HTTP ${landing.status}`);
  const submittedSource = source;
  source = landing.url;
  const initial = landing.body.toString(), origin = new URL(source).origin;
  if (state && state.source !== source) throw Error('Discovery checkpoint source changed');
  const model = state || {
    schema: 'website-return/v1', source, submittedSource,
    identity: { title: '', wordpressLikely: /wp-content|wp-includes|api\.w\.org/.test(initial) },
    pages: [], navigation: [], media: [], warnings: [],
    metrics: { aiCalls: 0, inputTokens: 0, outputTokens: 0, inferenceCostUSD: 0, repairIterations: 0 },
    createdAt: new Date().toISOString(),
    crawl: { queue: sample?[...sample]:[source], seen: [], rest: { pages: 1, posts: 1 }, restDone: [], restSignatures: {}, sitemapQueue: [], sitemapSeen: [], initialized: false, failures: [] },
  };
  if (!model.wordpressApiRoot) {
    try {
      const href=load(initial)('link[rel="https://api.w.org/"]').first().attr('href');
      if(href){const api=new URL(href,source);if(api.origin===origin&&!api.search&&!api.hash)model.wordpressApiRoot=api.href.replace(/\/$/,'');}
    } catch {}
  }
  model.observedRedirects ||= [];
  const redirectKeys=new Set(model.observedRedirects.map(r=>JSON.stringify(r)));
  const observeRedirects=response=>{for(const r of response.redirects||[]){const key=JSON.stringify(r);if(!redirectKeys.has(key)){redirectKeys.add(key);model.observedRedirects.push(r);}}};
  observeRedirects(landing);
  const c = model.crawl, seen = new Set(c.seen), queued = new Set(c.queue);
  const enqueue = (value, base = source) => {
    try {
      const u = new URL(value, base), home = new URL(source);
      if (['http:', 'https:'].includes(u.protocol) && !u.port && !home.port && u.hostname.replace(/^www\./, '') === home.hostname.replace(/^www\./, '')) { u.protocol = home.protocol; u.host = home.host; }
      u.hash = '';
      u.searchParams.sort();
      for (const key of [...u.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid|msclkid)$/i.test(key)) u.searchParams.delete(key);
      if (u.origin !== origin || (u.search && !staticQuery(u)) || /\.(xml|json|png|jpe?g|gif|pdf|css|js|webp|avif|svg|ico|zip|woff2?|ttf|otf|mp4|webm)$/i.test(u.pathname) || /(?:^|\/)(wp-admin|wp-login\.php|wp-json)(?:\/|$)/.test(u.pathname)) return;
      if(sample&&!sample.has(u.href))return;
      if (!seen.has(u.href) && !queued.has(u.href)) { c.queue.push(u.href); queued.add(u.href); }
    } catch {}
  };
  const calendarSkipped=new Set(c.calendarNavigationSkipped||[]);
  const collect = (html, base = source) => {
    const links=calendarDiscoveryLinks(html,base);
    for(const url of links.navigation)calendarSkipped.add(url);
    for(const url of links.content)enqueue(url,base);
    c.calendarNavigationSkipped=[...calendarSkipped];
  };
  // Upgrade discovery-only checkpoints without deleting captured pages or assets.
  // Ordinary links to the same URL take precedence over navigation exclusions.
  if(state){
    const navigation=new Set(),content=new Set([source]);
    for(const page of model.pages){
      const links=calendarDiscoveryLinks(page.sourceHTML||'',page.documentURL||page.url);
      for(const url of links.navigation)navigation.add(url);
      for(const url of links.content)content.add(url);
    }
    c.queue=c.queue.filter(url=>{
      if(!navigation.has(url)||content.has(url))return true;
      calendarSkipped.add(url);queued.delete(url);return false;
    });
    c.calendarNavigationSkipped=[...calendarSkipped];
  }
  let lastCheckpoint = 0;
  const save = async (force = false) => {
    c.seen = [...seen];
    if(calendarSkipped.size){
      const warning='Calendar previous/next date navigation was not recursively crawled; dated interactive views require calendar support. Event content and ordinary links remain discoverable.';
      if(!model.warnings.includes(warning))model.warnings.push(warning);
    }
    model.discovery = { mode: sample?'fixed-url-sample':maxPages == null ? 'whole-site' : 'explicit-sample', sampleUrls:sample?[...sample]:undefined, visited: seen.size, queued: c.queue.length, limited: c.queue.length > 0, maxPages, failures: c.failures, enumerationComplete: c.restDone.length === (model.wordpress?.types.length || 2) && !c.sitemapQueue.length };
    // Bound repeated full-model serialization on large crawls. A hard process
    // interruption can repeat at most this interval; handled pauses always save.
    if (force || Date.now() - lastCheckpoint >= 5000) {
      await onCheckpoint(model);
      lastCheckpoint = Date.now();
    }
  };
  const failure = (url, error, required = false) => {
    model.warnings.push(`${url}: ${error.message}`);
    if (required) c.failures.push({ url, reason: error.message });
  };
  if (!c.initialized) {
    collect(initial);
    c.sitemapQueue = sample?[]:[...new Set([...(network.robots.get(origin)?.getSitemaps() || []), origin + '/wp-sitemap.xml', origin + '/sitemap.xml'])];
    c.initialized = true;
  }
  try {
    const wp = await wordpressCatalog(model, network, origin, save, enqueue);
    if(!sample)await discoverProducts(model,network,{html:initial,save,enqueue,maxPages});
    for (const type of wp.types) {
      if(sample)break;
      if (maxPages != null && c.queue.length >= maxPages) break;
      const kind = ["page","post"].includes(type.slug) ? type.rest_base : (type.rest_namespace || "wp/v2") + "/" + type.rest_base;
      c.rest[kind] ||= 1;
      while (!c.restDone.includes(kind) && (maxPages == null || c.queue.length < maxPages)) {
        const n = c.rest[kind], url = restURL(origin, type, wp.apiRoot) + `?per_page=100&page=${n}&_embed=author,wp:featuredmedia`;
        try {
          const r = await network.get(url);
          if (r.status !== 200) {
            if (n > 1 && r.status !== 400) failure(url, Error(`HTTP ${r.status}`), true);
            c.restDone.push(kind); break;
          }
          const rows = JSON.parse(r.body);
          if (!Array.isArray(rows)) { c.restDone.push(kind); break; }
          await discoverCustomFieldSchema(model,network,type,rows);
          const signature = hash(JSON.stringify(rows.map(row => row.link || row.id)));
          if (rows.length && c.restSignatures[kind]?.includes(signature)) { failure(url, Error('REST pagination repeated a previous page'), true); c.restDone.push(kind); break; }
          (c.restSignatures[kind] ||= []).push(signature);
          for (const row of rows) if (row.link && (!row.status || row.status === "publish")) { recordWordpress(model, row, type); enqueue(row.link); }
          c.rest[kind]++;
          const total = Number(r.headers?.['x-wp-totalpages']);
          if (!rows.length || (Number.isFinite(total) && total > 0 ? n >= total : rows.length < 100)) c.restDone.push(kind);
        } catch (error) { if (['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(error.code)) throw error; failure(url, error, n > 1); c.restDone.push(kind); }
        await save();
      }
    }
    while (c.sitemapQueue.length && (maxPages == null || c.queue.length < maxPages)) {
      const url = c.sitemapQueue[0];
      if (c.sitemapSeen.includes(url)) { c.sitemapQueue.shift(); continue; }
      try {
        if (new URL(url).origin !== origin) throw Error('Cross-origin sitemap omitted');
        const xml = await network.text(url), $ = load(xml, { xmlMode: true });
        $('url > loc').each((i,e) => enqueue($(e).text()));
        $('sitemap > loc').each((i,e) => { try { const child = new URL($(e).text(), url).href; if (new URL(child).origin === origin && !c.sitemapSeen.includes(child) && !c.sitemapQueue.includes(child)) c.sitemapQueue.push(child); } catch {} });
      } catch (error) { if (['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(error.code)) throw error; failure(url, error, !/HTTP (404|410)|not found/i.test(error.message)); }
      c.sitemapSeen.push(url); c.sitemapQueue.shift(); await save();
    }
    while (c.queue.length && (maxPages == null || model.pages.length < maxPages)) {
      const url = c.queue[0];
      try {
        const response=url===source?landing:await network.get(url);
        observeRedirects(response);
        if(response.status!==200)throw Error('HTTP '+response.status+': '+url);
        const finalURL=response.url||url;
        if(new URL(finalURL).origin!==origin){model.pages.push(externalRedirectPage(url,finalURL));seen.add(url);queued.delete(url);c.queue.shift();await save();continue;}
        const html=response.body.toString();
        if (!/<html|<body/i.test(html)) throw Error('Destination is not an HTML page');
        const page = extract(html, finalURL);page.url=url;page.route=pageRoute(url);page.documentURL=finalURL;
        model.pages.push(page); collect(html,finalURL);
        onEvent('Discovering pages', { pages: model.pages.length, queued: c.queue.length - 1 });
      } catch (error) { if (['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(error.code)) throw error; failure(url, error, true); }
      seen.add(url); queued.delete(url); c.queue.shift(); await save();
    }
  } catch (error) {
    await save(true);
    if (error.code === 'CRAWL_BUDGET') error.message = 'Discovery paused at a resource safety boundary. Resume to continue the saved URL queue; no page-count limit was applied.';
    throw error;
  }
  mapWordpress(model);
  await enrichEvents(model,network,save);
  await enrichForms(model,network,save);
  mapWordpress(model);
  model.identity.title = model.pages[0]?.title || 'Website';
  model.navigation = model.pages[0]?.navigation || [];
  await save(true);
  model.discovery.complete = !model.discovery.limited && model.discovery.enumerationComplete && !c.failures.length;
  return model;
}
