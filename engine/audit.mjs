import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import robotsParser from 'robots-parser';
import { chromium } from 'playwright';
import { serveStatic } from './static.mjs';
export const unavailable = 'NOT AVAILABLE — DATA ACCESS REQUIRED';
const csv = rows => {
  if (!rows.length) return '';
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const quote = value => '"' + String(value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : value).replaceAll('"', '""') + '"';
  return keys.map(quote).join(',') + '\n' + rows.map(r => keys.map(k => quote(r[k])).join(',')).join('\n') + '\n';
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function outputFile(root, route) {
  const decoded = decodeURIComponent(route);
  if (!decoded.startsWith('/') || decoded.includes('\\') || decoded.split('/').includes('..')) throw Error('Unsafe audit route');
  return path.join(root, decoded.endsWith('/') || !path.posix.extname(decoded) ? decoded + (decoded.endsWith('/') ? '' : '/') + 'index.html' : decoded);
}
export async function auditProject(project, { phase = 'after', performance = true } = {}) {
  let routes;
  try {routes=JSON.parse(await readFile(path.join(project,'output/export-routes.json'),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;routes=JSON.parse(await readFile(path.join(project,'routes.json'),'utf8'));}
  const cfg = JSON.parse(await readFile(path.join(project, 'kujo-ssg.json')));
  const root = path.join(project, 'output');
  const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8').catch(() => '');
  const sitemapURLs = load(sitemap, { xmlMode: true })('loc').map((i,e) => load(e, { xmlMode: true }).text()).get();
  const robots = await readFile(path.join(root, 'robots.txt'), 'utf8').catch(() => '');
  const rules = robotsParser(new URL('/robots.txt', cfg.site_url).href, robots);
  const pages = [], links = [], issues = [], imageRows = [], assets = new Map();
  const issue = (code, severity, route, evidence) => issues.push({ code, severity, route, evidence });
  const origin = new URL(sitemapURLs[0] || cfg.site_url).origin;
  // Export BASE_PATH is inferred from the home canonical, never from a remote fetch.
  let base = '';
  try { const $ = load(await readFile(outputFile(root, '/'), 'utf8')); base = new URL($('link[rel=canonical]').attr('href')).pathname.replace(/\/$/, ''); } catch {}
  const localPath = href => {
    const url = new URL(href, origin + base + '/');
    if (url.origin !== origin) return null;
    if (base && url.pathname !== base && !url.pathname.startsWith(base + '/')) return null;
    return url.pathname.slice(base.length) || '/';
  };
  async function asset(href) {
    let route;
    try { route = localPath(href); } catch { return null; }
    if (!route || !route.startsWith('/assets/')) return null;
    if (assets.has(route)) return assets.get(route);
    let size = 0;
    try { size = (await stat(outputFile(root, route))).size; } catch {}
    const entry = { route, bytes: size }; assets.set(route, entry);
    return entry;
  }
  for (const route of routes) {
    const row = { phase, url: origin + base + route.route, route: route.route, source_file: route.slug, production_status: unavailable };
    let html;
    try { html = await readFile(outputFile(root, route.route), 'utf8'); row.local_status = 200; }
    catch { row.local_status = 404; issue('missing-route','P0',route.route,'Generated HTML absent'); pages.push(row); continue; }
    const $ = load(html);
    const textDOM = load(html); textDOM('script,style,noscript,svg').remove();
    Object.assign(row, {
      title: $('head > title').first().text().trim(),
      meta_description: $('meta[name=description]').attr('content') || '',
      canonical: $('link[rel=canonical]').attr('href') || '',
      lang: $('html').attr('lang') || '', h1: $('h1').map((i,e)=>$(e).text().trim()).get(),
      headings: $('h1,h2,h3,h4,h5,h6').map((i,e)=>({level:Number(e.tagName.slice(1)),text:$(e).text().trim()})).get(),
      word_count: textDOM('body').text().trim().split(/\s+/).filter(Boolean).length,
      robots_directives: $('meta[name=robots],meta[name=googlebot]').map((i,e)=>$(e).attr('content') || '').get().join(','),
      schema_types: [], schema_errors: 0, image_count: $('img').length, missing_alt: $('img:not([alt])').length,
      missing_dimensions: $('img').filter((i,e)=>!$(e).attr('width') || !$(e).attr('height')).length,
      html_bytes: Buffer.byteLength(html), inline_js_bytes: $('script:not([src])').toArray().reduce((n,e)=>n+Buffer.byteLength($(e).text()),0),
      content_hash: createHash('sha256').update(textDOM('body').text()).digest('hex'),
      published_date: $('meta[property="article:published_time"]').attr('content') || '',
      modified_date: $('meta[property="article:modified_time"]').attr('content') || '',
      author: $('meta[name=author]').attr('content') || '',
    });
    row.canonical_self = row.canonical === row.url;
    row.indexable = row.canonical_self && !/\b(noindex|none)\b/i.test(row.robots_directives) && rules.isAllowed(row.url, 'Googlebot') !== false;
    row.sitemap_included = sitemapURLs.includes(row.url);
    row.title_length = row.title.length; row.description_length = row.meta_description.length;
    const omitted = $('[data-migration-unavailable]:not([data-migration-dynamic])').map((i, e) => $(e).attr('data-migration-unavailable')).get();
    if (omitted.length) issue('uncaptured-internal-destination', 'P1', route.route, `${new Set(omitted).size} destinations disabled because they are outside the static capture; see link-coverage.json`);
    if (!row.title) issue('missing-title','P1',route.route,'No document title');
    if (!row.meta_description) issue('missing-description','P2',route.route,'No description');
    if (!row.lang) issue('missing-language','P2',route.route,'No document language');
    if (row.h1.length !== 1) issue('heading-structure','P2',route.route,`${row.h1.length} primary headings; review meaning, do not invent content`);
    if (row.canonical !== row.url && !routes.some(r => origin + base + r.route === row.canonical)) issue('canonical-mismatch','P1',route.route,`${row.canonical} != ${row.url}`);
    if (row.sitemap_included !== row.indexable) issue('sitemap-indexability','P1',route.route,`indexable=${row.indexable}, sitemap=${row.sitemap_included}`);
    if (row.missing_alt) issue('missing-alt','P2',route.route,`${row.missing_alt} images without alt; editorial review required`);
    if (row.missing_dimensions) issue('image-dimensions','P2',route.route,`${row.missing_dimensions} images lack intrinsic HTML dimensions; inspect CSS aspect ratios`);
    for (const e of $('script[type="application/ld+json"]')) {
      try {
        const value = JSON.parse($(e).text());
        const visit = v => { if (!v || typeof v !== 'object') return; if (v['@type']) row.schema_types.push(...[v['@type']].flat()); for (const x of Object.values(v)) if (typeof x === 'object') (Array.isArray(x) ? x : [x]).forEach(visit); };
        visit(value);
      } catch { row.schema_errors++; issue('invalid-jsonld','P1',route.route,'JSON-LD cannot be parsed'); }
    }
    row.schema_types = [...new Set(row.schema_types)];
    for (const e of $('a[href]')) {
      const href = $(e).attr('href'); let url;
      try { url = new URL(href, row.url); } catch { continue; }
      if (!['http:','https:'].includes(url.protocol)) continue;
      const destination = localPath(url.href);
      links.push({ phase, source_url: row.url, source_route: route.route, destination_url: url.href, destination_route: destination, source_absolute: /^https?:\/\//.test(href), anchor_text: $(e).text().trim(), rel: $(e).attr('rel') || '', verification: destination ? 'local export' : 'NOT AVAILABLE — DATA ACCESS REQUIRED' });
    }
    for (const e of $('img')) {
      const file = await asset($(e).attr('src') || '');
      imageRows.push({ phase, url: row.url, src: $(e).attr('src'), alt: $(e).attr('alt'), width: $(e).attr('width'), height: $(e).attr('height'), loading: $(e).attr('loading'), bytes: file?.bytes ?? null });
    }
    for (const e of $('link[rel=stylesheet],script[src]')) await asset($(e).attr('href') || $(e).attr('src'));
    pages.push(row);
  }
  const byRoute = new Map(pages.map(p=>[p.route,p]));
  for (const link of links.filter(l=>l.destination_route)) {
    const dest = byRoute.get(link.destination_route) || byRoute.get(link.destination_route.replace(/\/$/,'') + '/');
    if (dest) { dest.internal_inbound_links = (dest.internal_inbound_links || 0) + 1; link.local_status = dest.local_status; }
    else if (link.source_absolute) { link.destination_route = null; link.verification = 'Outside captured scope; remote destination not probed'; }
    else { try { await stat(outputFile(root, link.destination_route)); link.local_status=200; } catch { link.local_status=404; issue('broken-internal-link','P1',link.source_route,link.destination_url); } }
  }
  // Index once: shared navigation on large sites can produce millions of edges.
  const outgoing = new Map(), counts = new Map(), duplicates = {title:new Map(),meta_description:new Map()};
  for (const link of links) {
    if (!outgoing.has(link.source_route)) outgoing.set(link.source_route, []);
    if (link.destination_route && byRoute.has(link.destination_route)) outgoing.get(link.source_route).push(link.destination_route);
    const count = counts.get(link.source_route) || {internal:0,external:0};
    count[link.destination_route ? 'internal' : 'external']++;
    counts.set(link.source_route,count);
  }
  for (const page of pages) for (const key of ['title','meta_description'])
    if (page.indexable && page[key]) duplicates[key].set(page[key],(duplicates[key].get(page[key])||0)+1);
  const depth = new Map([['/',0]]), queue=['/'];
  for(let cursor=0;cursor<queue.length;cursor++) {
    const from=queue[cursor];
    for(const destination of outgoing.get(from)||[]) if(!depth.has(destination)){depth.set(destination,depth.get(from)+1);queue.push(destination);}
  }
  for (const p of pages) {
    p.page_depth = depth.get(p.route) ?? null; p.orphan = p.route!=='/' && !p.internal_inbound_links;
    p.internal_outbound_links = counts.get(p.route)?.internal || 0;
    p.external_outbound_links = counts.get(p.route)?.external || 0;
    for (const key of ['title','meta_description']) if(p.indexable && p[key] && duplicates[key].get(p[key])>1) issue('duplicate-'+key,'P2',p.route,p[key]);
    if(p.orphan) issue('orphan','P2',p.route,'No inbound link within captured scope');
  }
  const result = { schema:'post-build-audit/v1', phase, createdAt:new Date().toISOString(), scope:'generated export only; preview intentionally noindex; no production requests', pages, links, images:imageRows, assets:[...assets.values()], issues, performance:[], unavailable:{fieldCWV:unavailable,INP:unavailable,rankings:unavailable,traffic:unavailable,aiCitations:unavailable,production:unavailable,externalLinkStatus:unavailable,contentAuthorityReview:unavailable}, limits:['JSON-LD parsing/types are not rich-result eligibility or factual validation.','Metadata checks do not measure content quality or AI citation likelihood.','No training-crawler policy changes.','Local lab timings are not field Core Web Vitals or a Lighthouse score.'] };
  if (performance) {
    const server=await serveStatic(root), browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
    try {
      const representative=[...new Map(routes.map(r=>[r.family || r.slug,r])).values()].slice(0,3);
      // Old manifests have no family: always include home then up to two routes.
      const selected=[routes.find(r=>r.route==='/') || routes[0],...representative].filter((r,i,a)=>a.findIndex(x=>x.route===r.route)===i).slice(0,3);
      for(const route of selected) for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) {
        const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
        const page=await context.newPage();const requests=[];
        await context.route('**/*',r=>r.request().url().startsWith(server.url+'/')?r.continue():r.abort());
        await context.addInitScript(()=>{window.__lab={lcp:null,cls:0,longTasks:0};for(const type of ['largest-contentful-paint','layout-shift','longtask']){try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')window.__lab.lcp=e.startTime;if(type==='layout-shift'&&!e.hadRecentInput)window.__lab.cls+=e.value;if(type==='longtask')window.__lab.longTasks+=e.duration;}}).observe({type,buffered:true});}catch{}}});
        page.on('response',r=>requests.push({url:r.url().replace(server.url,''),status:r.status()}));
        const row={phase,url:origin+base+route.route,viewport:viewport.name,environment:'local loopback Chromium; cold context; no CPU/network throttling; 2 second observation',browser:browser.version(),inp_ms:unavailable};
        try {
          await page.goto(server.url+route.route,{waitUntil:'networkidle',timeout:20000});await page.waitForTimeout(2000);
          Object.assign(row,await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];const r=performance.getEntriesByType('resource');return{lcp_ms:window.__lab.lcp,cls:window.__lab.cls,long_task_ms:window.__lab.longTasks,ttfb_ms:n.responseStart-n.requestStart,dom_content_loaded_ms:n.domContentLoadedEventEnd,resource_bytes:r.reduce((s,x)=>s+x.decodedBodySize,0),resource_count:r.length};}));row.requests=requests;
          if(row.resource_bytes>5e6)issue('page-weight','P2',route.route,`${row.resource_bytes} decoded resource bytes in ${viewport.name} sample (5 MB advisory budget)`);
          if(row.lcp_ms>2500)issue('lab-lcp','P2',route.route,`${Math.round(row.lcp_ms)}ms local LCP observation; field validation required`);
        }catch(error){row.error=error.message;issue('performance-unmeasured','P1',route.route,error.message);}finally{await context.close();}
        result.performance.push(row);
      }
    }finally{await browser.close();await server.close();}
  }
  result.summary={pages:pages.length,issues:issues.length,rootCauses:new Set(issues.map(i=>i.code)).size,P0:issues.filter(i=>i.severity==='P0').length,P1:issues.filter(i=>i.severity==='P1').length,performanceSamples:result.performance.length};
  result.status=result.summary.P0?'BLOCKED':issues.length?'PASS WITH RECOMMENDATIONS':'PASS';
  return result;
}
export async function writeAudit(result, dir) {
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'post-build-audit.json'),JSON.stringify(result,null,2));
  for(const [name,rows] of Object.entries({pages:result.pages,issues:result.issues,links:result.links,images:result.images,performance:result.performance})) await writeFile(path.join(dir,name+'.csv'),csv(rows));
  await writeFile(path.join(dir,'post-build-audit.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Post-build audit</title><style>body{font:16px system-ui;max-width:1000px;margin:3rem auto;padding:1rem}td,th{text-align:left;padding:.6rem;border-bottom:1px solid #ddd}code{overflow-wrap:anywhere}</style><h1>${escape(result.status)}</h1><p>${result.summary.pages} pages checked; ${result.summary.rootCauses} issue categories. Generated-output checks only. No ranking, citation or field-performance claim.</p><table><tr><th>Severity</th><th>Check</th><th>Route</th><th>Evidence</th></tr>${result.issues.map(i=>`<tr><td>${i.severity}</td><td>${escape(i.code)}</td><td>${escape(i.route)}</td><td>${escape(i.evidence)}</td></tr>`).join('')}</table><h2>Unavailable measurements</h2><pre>${escape(JSON.stringify(result.unavailable,null,2))}</pre></html>`);
}
