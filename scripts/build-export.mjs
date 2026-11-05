import {applyProductOrdering,collectProductCatalog,writeProductCatalogs} from './product-ordering.mjs';
import {applyProductTaxonomies} from './product-taxonomies.mjs';
import {applyCalendarClock} from './calendar-clock.mjs';
const calendarPresentations=new Map();
import {collectCalendarPresentation,calendarPresentation,applyCalendarViewLinks,applyCalendarArchivePage} from './calendar-presentation.mjs';
import {calendarEvent,applyEventCalendar,archiveCalendar,applyArchiveCalendar} from './events-export.mjs';
import {prepareConsent,applyConsent} from './consent-export.mjs';
import {applyCommerce} from './commerce-export.mjs';
import {exportRedirects,redirectPlan,applyRedirectNavigation} from './redirect-export.mjs';
import {applyForms} from './form-export.mjs';
import {applySEO,createSEOContext} from './seo-export.mjs';
import {applyComponents} from './component-export.mjs';
import {semanticExport} from './semantic-export.mjs';
import { applyNavigation, aliases, finishExport, checkOutputName } from './finish-export.mjs';
import { applyTaxonomyClasses, readConfig, loadProject, refreshSourceArchives, prepareContent, refreshLinks, routeSafe, load, within, optionalJSON } from './source.mjs';
import { buildArchives } from './archives.mjs';
import { checkAgentExport } from './check-agent-export.mjs';
import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { compileNative } from "./compile-native.mjs";
import path from "node:path";
const cfg = await readConfig();
for(let i=2;i<process.argv.length;i++){const arg=process.argv[i];const options={'--site-url':'site_url','--base-path':'base_path','--posts-per-page':'posts_per_page','--feed-limit':'feed_limit','--sort-by':'sort_by','--output':'output'};if(options[arg]){if(!process.argv[i+1])throw Error('Missing '+arg);cfg[options[arg]]=process.argv[++i];}else if(arg==='--minify')cfg.minify=true;else if(arg!=='--drafts')throw Error('Unknown build option: '+arg);}
if(!Number.isInteger(Number(cfg.posts_per_page||20))||Number(cfg.posts_per_page||20)<1)throw Error('posts_per_page must be positive');
if(cfg.feed_limit!==undefined&&(!Number.isInteger(Number(cfg.feed_limit))||Number(cfg.feed_limit)<0))throw Error('feed_limit must be zero (all) or positive');
checkOutputName(cfg.output==='.ssg-output'?'output':cfg.output||'output');
const project = await loadProject(cfg);
const routes = project.routes;
await prepareContent(project);
const archiveMaintenance=await refreshSourceArchives(project,cfg);
const base = (process.env.BASE_PATH || cfg.base_path || "").replace(/\/$/, "");
if (base && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(base))
  throw Error("Unsafe BASE_PATH");
const site = new URL(process.env.SITE_URL || cfg.site_url);
if (
  !["https:", "http:"].includes(site.protocol) ||
  site.username ||
  site.password
)
  throw Error("Invalid SITE_URL");
const e = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const safe = (r) => {
  if (
    !r.startsWith("/") ||
    r.includes("\\") ||
    r.includes("//") ||
    /[\x00-\x20]/.test(r) ||
    r
      .split("/")
      .some(
        (x) =>
          [".", ".."].includes(decodeURIComponent(x)) ||
          decodeURIComponent(x).includes("/"),
      )
  )
    throw Error("Unsafe route");
  return r;
};
// Compile structured fragments through shared family templates. Kujo's Markdown renderer
// intentionally escapes raw HTML, so fragments belong in template input, not Markdown body.
await rm(".ssg-content", { recursive: true, force: true });
await rm(".ssg-templates", { recursive: true, force: true });
await mkdir(".ssg-content/pages", { recursive: true });
await cp("templates", ".ssg-templates", { recursive: true });
for (const file of await readdir('content')) if (/^[a-z0-9-]+\.yml$/.test(file)) await cp('content/'+file,'.ssg-content/'+file);
for (const p of routes) {
  const collection=p.collection || 'pages';
  if (!/^[a-z][a-z0-9-]*$/.test(collection)) throw Error('Unsafe content type');
  p.collection=collection;
  await mkdir('.ssg-content/'+collection,{recursive:true});
  const meta = {...p.meta};
  meta.template ||= "native";
  p.title = meta.title || p.title; p.description = meta.description || ""; p.lang = meta.lang || "en"; p.date = meta.date || ""; p.excerpt = meta.excerpt || "";
  if (!/^[a-z0-9-]+$/.test(meta.template)) throw Error("Unsafe template");
  if(project.sourceV2){
    // Native SSG receives real Markdown and shared templates; the adapter restores
    // explicit layout slots/components after native Markdown/feed compilation.
    if(meta.template==='migration') {
      p.renderedSource=refreshLinks(p.fragment,project);
    } else {
      const skeleton=await readFile(`templates/page-${meta.template}.html`,'utf8');
      await writeFile(`.ssg-templates/post-${meta.template}.html`,skeleton);
    }
    const front={...meta};delete front.permalink;delete front.canonical;
    // Presentation data belongs to the authoring adapter, not the native public index.
    for(const key of ['layout_values','layout_attributes','layout_repeats','layout_regions','layout_data','components','content_template','content_slots','template_evidence'])delete front[key];
    await writeFile(`.ssg-content/${collection}/${p.slug}.md`,"---\n"+Object.entries(front).map(([k,v])=>k+": "+JSON.stringify(v)).join("\n")+"\n---\n\n"+(p.nativeBody||p.body)+"\n");
  }else{
    const skeleton=await readFile(`templates/page-${meta.template}.html`,'utf8');
    await writeFile(`.ssg-templates/${collection==='pages'?'page':'post'}-${p.slug}.html`,refreshLinks(skeleton.replace('{{body}}',()=>refreshLinks(p.fragment,project)),project));
    const front={...meta,template:p.slug};delete front.permalink;delete front.canonical;
    await writeFile(`.ssg-content/${collection}/${p.slug}.md`,"---\n"+Object.entries(front).map(([k,v])=>k+": "+JSON.stringify(v)).join("\n")+"\n---\n");
  }
}
const nativeFeedItems = await compileNative(routes, cfg);
await rm("output", { recursive: true, force: true });
await mkdir("output", { recursive: true });
await writeFile("output/content-source-report.json",JSON.stringify({schema:'content-source-build/v1',canonical:project.sourceV2?'markdown-frontmatter':'legacy',htmlSnapshotFallback:!project.sourceV2,records:routes.map(p=>({route:p.route,file:p.file+'.md',template:p.meta.content_template||p.meta.template||'native',components:Object.keys(p.meta.components||{}).length,markdownCharacters:p.body.length}))},null,2));
await writeFile("output/maintenance-report.json",JSON.stringify(archiveMaintenance,null,2));
await cp("assets", "output/assets", { recursive: true });
try{await cp(".ssg-output/assets","output/assets",{recursive:true,force:false,errorOnExist:false});}catch(error){if(error.code!=="ENOENT")throw error;}
try{await cp(".ssg-output/images","output/images",{recursive:true});}catch(e){if(e.code!=="ENOENT")throw e;}
const nativeIndex = JSON.parse(await readFile('.ssg-output/.well-known/kujo-site-index.json','utf8'));
for(const p of routes){const item=nativeIndex.items.find(i=>i.slug===p.slug&&i.type===p.collection);if(item)item.taxonomies=p.taxonomies;}
const archivePages = await buildArchives(routes,nativeIndex,{base,origin:site.origin,title:cfg.site_title,postsPerPage:cfg.posts_per_page||20});
const searchDocuments = [];
const componentPages = [];
const seoPages=[];
const formSettings=await optionalJSON('form-settings.json',{revision:0,forms:{}});
const formContractsByRoute=new Map();
for(const originalForm of (await optionalJSON('forms.json',{forms:[]})).forms){const form={...originalForm,delivery:formSettings.forms?.[originalForm.id]||originalForm.delivery};if(!formContractsByRoute.has(form.route))formContractsByRoute.set(form.route,[]);formContractsByRoute.get(form.route).push(form);}
const consentConfig=prepareConsent(await optionalJSON('consent.json',{}),[...formContractsByRoute.values()].flat(),base);
for(const service of consentConfig.services)if(!routes.some(p=>(p.sourceRoute||p.route)===service.route))consentConfig.issues.push({id:service.id,reason:'Service route is not exported'});
if(consentConfig.issues.length){await writeFile('consent-report.json',JSON.stringify({issues:consentConfig.issues},null,2));throw Error('Invalid consent configuration; see consent-report.json');}
const consentPages=[];
const formPages=[];
const productCatalogs=new Map();
const commercePages=[];const eventPages=[];const unavailableLinks=new Map();
const eventArchiveBindings=(await optionalJSON('archive-bindings.json',{bindings:[]})).bindings;
await mkdir('output/assets/calendars',{recursive:true});
const seoContext=createSEOContext({source:cfg.site_url,origin:site.origin,base,routes,assets:await optionalJSON('seo-assets.json',[])});
const observedRedirects=(await optionalJSON('observed-redirects.json',{redirects:[]})).redirects;
const importedRedirects=await optionalJSON('redirects.import.json',{redirects:[]});
const navigationRedirectPlan=redirectPlan({observed:observedRedirects,imported:importedRedirects,routes,source:cfg.site_url,base});
const redirectNavigation=[];
const publicRoute=route=>!routes.find(p=>p.route===route&&/\b(noindex|none)\b/i.test(p.robots||""));
for (const p of routes) {
  safe(p.route);
  const dest = path.join(
    "output",
    p.route.endsWith("/") || !path.posix.extname(p.route)
      ? path.posix.join(decodeURIComponent(p.route), "index.html")
      : decodeURIComponent(p.route),
  );
  await mkdir(path.dirname(dest), { recursive: true });
  let html = await readFile(`.ssg-output/${!["pages","posts"].includes(p.collection) ? p.collection+"/" : ""}${p.slug}/index.html`, "utf8");
  if(p.renderedSource!==undefined){
    const marker=/MIGRATION_RENDER_START[\s\S]*?MIGRATION_RENDER_END/;
    if(!marker.test(html))throw Error('Missing native content boundary: '+p.route);
    html=html.replace(marker,()=>p.renderedSource);
  }
  html = html.replaceAll(cfg.site_url.replace(/\/$/, "") + "/images/", site.origin + base + "/images/");
  // Native SSG uses temporary slugs. The template contains our hash-pinned,
  // route-aware adapter; remove any additional native external injection.
  html = html.replace(/<script\b[^>]*src=["'][^"']*kujo-webmcp(?:\.min)?\.js["'][^>]*>[\s\S]*?<\/script>/gi, '');
  const canonical = site.origin + base + safe(p.canonicalRoute || p.route);
  html = html
    .replace(/__BODY_CLASS__/g, e(p.bodyClass||""))
    .replace('__HTML_ATTRIBUTES__',()=>Object.entries(p.documentAttributes?.html||{}).filter(([k])=>['id','dir','class','style'].includes(k)||/^data-[a-z0-9_-]+$/i.test(k)).map(([k,v])=>k+'="'+e(v)+'"').join(' '))
    .replace('__BODY_ATTRIBUTES__',()=>Object.entries(p.documentAttributes?.body||{}).filter(([k])=>['id','dir','style'].includes(k)||/^data-[a-z0-9_-]+$/i.test(k)).map(([k,v])=>k+'="'+e(v)+'"').join(' '))
    .replace("__PAGE_MOTION__", `<meta name="migration-motion" content="${e(JSON.stringify(p.motion || {}))}">`)
    .replace("__PAGE_STYLES__", (p.preservedShell ? "" : '<link rel="stylesheet" href="/assets/css/sitekit.css"><link rel="stylesheet" href="/assets/css/design.css">') + `<link rel="stylesheet" href="/assets/css/${p.styleSlug||p.slug}.css">`)
    .replace(
      /<link rel="canonical"[^>]*>/g,
      `<link rel="canonical" href="${e(canonical)}">`,
    )
    .replace(/\b(href|src|poster)="\/(?!\/)/g, `$1="${base}/`);
  html = html.replace(/srcset="([^"]*)"/g, (_, values) => 'srcset="' + values.split(",").map(value => value.trim().replace(/^\/(?!\/)/, base + "/")).join(", ") + '"');
  html = html
    .replaceAll(site.origin + "/" + p.slug + "/", canonical)
    .replaceAll(
      cfg.site_url.replace(/\/$/, "") + "/" + p.slug + "/",
      canonical,
    );
  if(cfg.fonts?.length)html=html.replace('</head>',`<link rel="stylesheet" href="${base}/assets/css/fonts.css"></head>`);
  if(p.meta.template==='docs')html=html.replace('</head>',`<link rel="stylesheet" href="${base}/assets/css/docs.css"></head>`);
  if(p.meta.favicon)html=html.replace("</head>",`<link rel="icon" href="${base}/${e(p.meta.favicon)}"></head>`);
  if(archivePages.length)html=html.replace("</head>",`<link rel="contents" href="${base+archivePages.at(-1).route}" title="Content archives"></head>`);
  html = html.replace(
    "</head>",
    `<meta name="robots" content="${e(p.robots || "index,follow")}"></head>`,
  );
  html=await applyNavigation(html,project,base,p.route);
  {const $=load(html);applyCalendarArchivePage($,p);if(p.meta.event){try{const calendar=calendarEvent(p,site.origin,base);await writeFile('output'+calendar.route,calendar.text);applyEventCalendar($,calendar,base);eventPages.push({route:p.route,status:'calendar-exported',calendar:calendar.route,recurrence:p.meta.event.recurrence?.status||'unverified',presentationIssues:p.eventPresentationIssues||[]});}catch(error){eventPages.push({route:p.route,status:'invalid-event',error:error.message});}}if(!p.meta.event&&$('.tribe-events-c-subscribe-dropdown').length){const feed=archiveCalendar(p,routes,eventArchiveBindings,site.origin,base);if(feed){await writeFile('output'+feed.route,feed.text);await writeFile('output'+feed.manifestRoute,JSON.stringify(feed.manifest));$('.tribe-events-view').attr('data-migration-calendar',base+feed.manifestRoute);collectCalendarPresentation($,feed,calendarPresentations,{file:dest,route:p.route,url:base+p.route,manifestURL:base+feed.manifestRoute});applyArchiveCalendar($,feed,base);eventPages.push({route:p.route,status:feed.issues.length?'partial-calendar-feed':'calendar-feed-exported',calendar:feed.route,manifest:feed.manifestRoute,included:feed.included,issues:feed.issues,subscription:'Requires a publicly reachable published URL; local ICS download works offline.'});}else eventPages.push({route:p.route,status:'unbound-calendar-feed'});}seoPages.push({route:p.route,issues:applySEO($,p,{...seoContext,source:p.source||cfg.site_url})});semanticExport($,new Map(routes.map(r=>[base+r.route,r.title])),p.title);formPages.push({route:p.route,forms:applyForms($,p,formContractsByRoute.get(p.sourceRoute||p.route)||[],base)});commercePages.push({route:p.route,...applyCommerce($,p.meta.product,base,p.saved?.metadata.product),taxonomyIssues:[...applyProductTaxonomies($,p,{lookups:project.lookups,bindings:eventArchiveBindings,routes,base,source:cfg.site_url}),...applyTaxonomyClasses($,$('.summary').first().closest('.product'),p,project)]});consentPages.push({route:p.route,...applyConsent($,p,consentConfig)});applyCalendarClock($,cfg.calendar_clock);commercePages[commercePages.length-1].ordering=applyProductOrdering($,p,{routes,bindings:eventArchiveBindings,base,context:productCatalogs});componentPages.push({route:p.route,selected:applyComponents($)});html=$.html();}
  const searchBody = (/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] || /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] || '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|#39);/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"})[x]).replace(/\s+/g, ' ').trim();
  searchDocuments.push({ route: p.route, title: p.title, text: searchBody, ...(p.meta.event?{kind:'event'}:{}) });
  {const $=load(html);redirectNavigation.push(...applyRedirectNavigation($,navigationRedirectPlan,{routes,source:cfg.site_url,base}).map(r=>({...r,route:p.route})));collectProductCatalog($,p,{context:productCatalogs,base});html=$.html();$('[data-migration-unavailable]').each((_,node)=>{const destination=$(node).attr('data-migration-unavailable');unavailableLinks.set(p.route+'\n'+destination,{source:p.route,destination});});}
  await writeFile(dest, html);
}
await writeFile('product-catalog-report.json',JSON.stringify(await writeProductCatalogs(productCatalogs),null,2));
await writeFile('consent-report.json',JSON.stringify({schema:'website-cloner-consent/v1',revision:consentConfig.revision,issues:consentConfig.issues,pages:consentPages},null,2));
if(consentPages.some(p=>p.issues.length))throw Error('Consent service binding failed; see consent-report.json');
for(const group of calendarPresentations.values()){
 const presentation=calendarPresentation(group);for(const manifest of group.manifests)await writeFile('output'+manifest.replace(/\.json$/,'.presentation.json'),JSON.stringify(presentation));
 for(const [file,route]of group.pages){const $=load(await readFile(file,'utf8'));applyCalendarViewLinks($,group.viewRoutes,$('[data-migration-calendar]').filter((_,node)=>group.manifestURLs.has($(node).attr('data-migration-calendar'))));await writeFile(file,$.html());for(const key of unavailableLinks.keys())if(key.startsWith(route+'\n'))unavailableLinks.delete(key);$('[data-migration-unavailable]').each((_,node)=>{const destination=$(node).attr('data-migration-unavailable');unavailableLinks.set(route+'\n'+destination,{source:route,destination});});}
}
await writeFile('link-coverage.json',JSON.stringify({unavailable:[...unavailableLinks.values()]},null,2));
await writeFile('events-report.json',JSON.stringify({schema:'website-cloner-events/v1',pages:eventPages},null,2));
await writeFile('commerce-runtime-report.json',JSON.stringify({schema:'website-cloner-commerce-runtime/v1',pages:commercePages},null,2));
await writeFile('form-delivery-report.json',JSON.stringify({schema:'website-cloner-form-delivery/v1',configurationRevision:formSettings.revision||0,pages:formPages},null,2));
await writeFile('seo-preservation-report.json',JSON.stringify({schema:'website-cloner-seo-preservation/v1',pages:seoPages},null,2));
await writeFile('component-runtime-report.json',JSON.stringify({schema:'website-cloner-components/v1',pages:componentPages},null,2));
const aliasPages=await aliases(routes,base,site.origin);
routes.push(...archivePages,...aliasPages);
const redirectReport=await exportRedirects({observed:[...observedRedirects,...aliasPages.map(p=>({from:p.route,to:p.canonicalRoute,status:301}))],imported:importedRedirects,routes,source:cfg.site_url,base});
redirectReport.navigationRewrites=redirectNavigation;
await writeFile('redirect-report.json',JSON.stringify(redirectReport,null,2));
searchDocuments.push(...archivePages.map(p=>({route:p.route,title:p.title,text:p.summary})));
await writeFile('output/export-routes.json',JSON.stringify(routes.map(p=>({route:p.route,collection:p.collection,generatedArchive:!!p.generatedArchive,generatedAlias:!!p.generatedAlias,robots:p.robots,canonicalRoute:p.canonicalRoute,sourceHeadingCount:p.sourceHeadingCount}))));
await writeFile(
  "output/sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    [...new Set(routes
      .filter((p) => !/\b(noindex|none)\b/i.test(p.robots || ""))
      .map((p) => site.origin + base + (p.canonicalRoute || p.route)))]
      .map(url => {const record=routes.find(p=>site.origin+base+(p.canonicalRoute||p.route)===url);const modified=record?.meta?.last_updated||record?.date;return `<url><loc>${e(url)}</loc>${modified&&!Number.isNaN(Date.parse(modified))?`<lastmod>${e(new Date(modified).toISOString())}</lastmod>`:""}</url>`;})
      .join("") +
    "</urlset>",
);
await writeFile(
  "output/robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${site.origin + base}/sitemap.xml\n`,
);
await writeFile("output/.nojekyll", "");
if(!routes.some(p=>p.route==="/404.html"))await writeFile(
  "output/404.html",
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page not found</title></head><body><main><h1>Page not found</h1><a href="' +
    base +
    '/">Return home</a></main></body></html>',
);
console.log(
  `Built ${routes.length} preserved routes at ${base || "/"} using Kujo SSG.`,
);

await writeFile('output/assets/search-index.json', JSON.stringify(searchDocuments.filter(d=>publicRoute(d.route))));

// Public agent discovery uses final routes and rebuilt text, never raw source metadata.
const publicPages = routes.filter(p => !/\b(noindex|none)\b/i.test(p.robots || ""));
const items = publicPages.map(p => {
  const native = p.generatedArchive ? {taxonomies:{}} : nativeIndex.items.find(i=>i.slug===p.slug && i.type===p.collection);
  if(!native)throw Error('Native SSG record missing for '+p.route);
  return ({ id: p.route, type: p.collection, slug: p.route,
  url: p.route, title: p.title, description: p.description || "",
  summary: searchDocuments.find(d => d.route === p.route)?.text || "",
  published:p.date||undefined,updated:p.meta?.last_updated||undefined,language: p.lang || "en", searchable: true, taxonomies: native.taxonomies || {} });});
await mkdir('output/.well-known', { recursive: true });
await writeFile('output/.well-known/kujo-site-index.json', JSON.stringify({
  schema: 'kujo-ssg-site-index/v1', site: { title: cfg.site_title, url: site.origin + base + '/' },
  navigation: (await optionalJSON('navigation.json',[])).filter(n=>n.url&&n.url.startsWith('/')&&publicRoute(n.url)), content_types: [...new Set(routes.map(i=>i.collection))].map(name=>({name,taxonomies:[...new Set(items.filter(i=>i.type===name).flatMap(i=>Object.keys(i.taxonomies)))]})), items
}));
const md = value => String(value || '').replace(/[\r\n\[\]\\]/g, ' ').trim();
await writeFile('output/llms.txt', '# ' + md(cfg.site_title) + '\n\n> Public content from this static website.\n\n## Pages\n\n' +
  items.map(i => '- [' + md(i.title) + '](' + site.origin + base + encodeURI(i.url).replace(/%25([a-f0-9]{2})/gi,'%$1').replace(/[()]/g, c => '%' + c.charCodeAt(0).toString(16)) + ')').join('\n') + '\n');
const agentIndex = JSON.parse(await readFile('output/.well-known/kujo-site-index.json', 'utf8'));
if (agentIndex.items.length !== publicPages.length || !(await readFile('output/llms.txt', 'utf8')).startsWith('# ')) throw Error('Agent discovery export validation failed');

await checkAgentExport("output", routes, base);

// Preserve native RSS item generation, adapting temporary compiler URLs to public routes.
const feedEntries=[];
for(const item of nativeFeedItems){
  const link=/<link>([^<]+)<\/link>/.exec(item)?.[1];
  const page=routes.find(p=>p.collection==='posts' && link===e(cfg.site_url.replace(/\/$/,'')+'/'+p.slug+'/'));
  if(!page || /\b(noindex|none)\b/i.test(page.robots||''))continue;
  feedEntries.push({date:Date.parse(page.date)||0,route:page.route,xml:item.replaceAll(link,e(site.origin+base+page.route))});
}
const publicPosts=routes.filter(p=>p.collection==='posts' && !/\b(noindex|none)\b/i.test(p.robots||''));
if(feedEntries.length!==publicPosts.length)throw Error('Native RSS coverage mismatch');
feedEntries.sort((a,b)=>b.date-a.date||a.route.localeCompare(b.route));
await mkdir('output/feed',{recursive:true});
const feed='<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>'+e(cfg.site_title)+'</title><link>'+e(site.origin+base+'/')+'</link><description>Latest posts</description>'+feedEntries.slice(0,Number(cfg.feed_limit)===0?undefined:Number(cfg.feed_limit)||20).map(i=>i.xml).join('')+'</channel></rss>';
await writeFile('output/feed/index.xml',feed);
if(feed.includes('/page-000') || feedEntries.some(i=>!routes.some(p=>p.route===i.route)))throw Error('Feed route validation failed');

await finishExport(cfg,base);
