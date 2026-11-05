import {restoreCachedFormSchemas} from './form-validation.mjs';
import {withoutRedirectCopies} from './redirect-pages.mjs';
import {localProduct} from './commerce.mjs';
import {captureSEO} from '../scripts/seo-export.mjs';
import {platformSupportReport} from './platform-support.mjs';
import {contentSlugs,descriptionSummary,pageDescription} from './authoring.mjs';
import {repairDuplicateDescriptions} from './metadata.mjs';
import {headingCSS} from './semantic-css.mjs';
import { navigationRuntime } from './navigation.mjs';
import {imageSize} from 'image-size';
import { exportToolkit } from './toolkit.mjs';
import { writeArchiveBindings } from './archive-bindings.mjs';
import { writeEditableProject } from './editable.mjs';
import { mapWordpress, taxonomyName } from './wordpress.mjs';
import { webmcpRuntime } from './webmcp.mjs';
import { searchRuntime } from './search.mjs';
import { runtimeSource, motionCSP } from './motion.mjs';
import { mkdir, writeFile, readFile, copyFile, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import YAML from "yaml";
import { clean, esc, hash, staticQuery, documentAttributes } from "./extract.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function validRoute(route) {
  if (
    !route.startsWith("/") ||
    route.includes("\\") ||
    route.includes("//") ||
    /[\x00-\x20]/.test(route) ||
    route.split("/").some((s) => {
      try {
        return (
          [".", ".."].includes(decodeURIComponent(s)) ||
          decodeURIComponent(s).includes("/")
        );
      } catch {
        return true;
      }
    })
  )
    throw Error("Unsafe route");
  return route;
}
export async function generate(model, project) {
  restoreCachedFormSchemas(model);
  model = withoutRedirectCopies(model);
  await mkdir(project, {recursive:true});
  await writeFile(path.join(project,'observed-redirects.json'),JSON.stringify({redirects:model.observedRedirects||[]},null,2));
  const support=platformSupportReport(model.pages);
  await writeFile(path.join(project,'platform-support.json'),JSON.stringify(support,null,2));
  await writeFile(path.join(project,'forms.json'),JSON.stringify({schema:'website-cloner-forms/v1',forms:support.pages.flatMap(p=>p.forms)},null,2));
  const headingStyles=new Map();
  const styled=css=>{if(!headingStyles.has(css))headingStyles.set(css,headingCSS(css));return headingStyles.get(css);};
  for (const d of ["content/pages", "templates", "assets/css", "scripts"])
    await mkdir(path.join(project, d), { recursive: true });
  for (const [from, to] of [
    ["vendor/ssg.kujo", "build.kujo"],
    ["vendor/sitekit.css", "assets/css/sitekit.css"],
    ["vendor/migration-search.css", "assets/css/migration-search.css"],
    ["vendor/SSG-LICENSE", "SSG-LICENSE"],
    ["vendor/SITEKIT-LICENSE", "SITEKIT-LICENSE"],
    ["scripts/build-export.mjs", "scripts/build.mjs"],
    ["scripts/compile-native.mjs", "scripts/compile-native.mjs"],
    ["scripts/archives.mjs", "scripts/archives.mjs"],
    ["vendor/export-source.mjs", "scripts/source.mjs"],
    ["scripts/render-markdown.kujo", "scripts/render-markdown.kujo"],
    ["scripts/site.mjs", "scripts/site.mjs"],
    ["scripts/finish-export.mjs", "scripts/finish-export.mjs"],
    ["scripts/menu-authoring.mjs", "scripts/menu-authoring.mjs"],
    ["scripts/semantic-export.mjs", "scripts/semantic-export.mjs"],
    ["scripts/seo-export.mjs", "scripts/seo-export.mjs"],
    ["scripts/form-export.mjs", "scripts/form-export.mjs"],
    ["scripts/product-gallery-markup.mjs", "scripts/product-gallery-markup.mjs"],
    ["scripts/commerce-export.mjs", "scripts/commerce-export.mjs"],
    ["scripts/product-presentation.mjs", "scripts/product-presentation.mjs"],
    ["scripts/product-taxonomies.mjs", "scripts/product-taxonomies.mjs"],
    ["scripts/events-export.mjs", "scripts/events-export.mjs"],
    ["scripts/calendar-presentation.mjs", "scripts/calendar-presentation.mjs"],
    ["scripts/calendar-view.mjs", "scripts/calendar-view.mjs"],
    ["scripts/calendar-clock.mjs", "scripts/calendar-clock.mjs"],
    ["scripts/event-presentation.mjs", "scripts/event-presentation.mjs"],
    ["scripts/component-calendar.js", "scripts/component-calendar.js"],
    ["scripts/redirect-export.mjs", "scripts/redirect-export.mjs"],
    ["scripts/component-forms.js", "scripts/component-forms.js"],
    ["scripts/component-choices.js", "scripts/component-choices.js"],
    ["scripts/component-input-mask.js", "scripts/component-input-mask.js"],
    ["scripts/vendor-inputmask.js", "scripts/vendor-inputmask.js"],
    ["vendor/INPUTMASK-LICENSE", "INPUTMASK-LICENSE"],
    ["scripts/component-export.mjs", "scripts/component-export.mjs"],
    ["scripts/component-addon-navigation.js", "scripts/component-addon-navigation.js"],
    ["scripts/component-media.mjs", "scripts/component-media.mjs"],
    ["scripts/slider-authoring.mjs", "scripts/slider-authoring.mjs"],
    ["scripts/consent-export.mjs", "scripts/consent-export.mjs"],
    ["scripts/component-consent.js", "scripts/component-consent.js"],
    ["scripts/component-markup.mjs", "scripts/component-markup.mjs"],
    ["scripts/component-tabs.js", "scripts/component-tabs.js"],
    ["scripts/component-disclosure.js", "scripts/component-disclosure.js"],
    ["scripts/component-tooltip.js", "scripts/component-tooltip.js"],
    ["scripts/component-breakpoints.js", "scripts/component-breakpoints.js"],
    ["scripts/component-carousel.js", "scripts/component-carousel.js"],
    ["scripts/component-smart-slider.js", "scripts/component-smart-slider.js"],
    ["scripts/component-truncation.js", "scripts/component-truncation.js"],
    ["vendor/PHOTOSWIPE-LICENSE", "PHOTOSWIPE-LICENSE"],
    ["scripts/vendor-photoswipe.js", "scripts/vendor-photoswipe.js"],
    ["scripts/vendor-photoswipe-ui.js", "scripts/vendor-photoswipe-ui.js"],
    ["scripts/component-product-lightbox.js", "scripts/component-product-lightbox.js"],
    ["scripts/component-product-gallery.js", "scripts/component-product-gallery.js"],
    ["scripts/component-product-options.js", "scripts/component-product-options.js"],
    ["scripts/product-ordering.mjs", "scripts/product-ordering.mjs"],
    ["scripts/component-product-ordering.js", "scripts/component-product-ordering.js"],
    ["scripts/component-inferred-menu.js", "scripts/component-inferred-menu.js"],
    ["scripts/component-named-drilldown.js", "scripts/component-named-drilldown.js"],
    ["scripts/component-named-popup.js", "scripts/component-named-popup.js"],
    ["scripts/component-responsive-details.js", "scripts/component-responsive-details.js"],
    ["scripts/component-details.js", "scripts/component-details.js"],
    ["scripts/component-accordion.js", "scripts/component-accordion.js"],
    ["scripts/component-filter-grid.js", "scripts/component-filter-grid.js"],
    ["scripts/package-export.py", "scripts/package-export.py"],
    ["scripts/render-archive-cards.kujo", "scripts/render-archive-cards.kujo"],
    ["scripts/check-agent-export.mjs", "scripts/check-agent-export.mjs"],
  ])
    await copyFile(path.join(root, from), path.join(project, to));
  for(const media of model.media||[])if(!media.width&&/^assets\/media\/[a-f0-9]+\.[a-z0-9]+$/.test(media.path)){
    try{const size=imageSize(await readFile(path.join(project,media.path)));media.width=size.width;media.height=size.height;}catch{}
  }
  const dimensions=new Map((model.media||[]).map(m=>['/'+m.path,m]));
  for(const p of model.pages)p.description=pageDescription(p);
  // Pagination is a distinct document; preserve source wording and add only
  // the page number already present in its public URL.
  for(const p of model.pages){const n=/\/page\/(\d+)\/?$/.exec(p.route)?.[1]||[...new URL(p.url).searchParams].find(([key,value])=>/^(?:paged|page|query-\d+-page)$/.test(key)&&/^[1-9]\d*$/.test(value))?.[1];if(n&&Number(n)>1){if(!new RegExp('(?:page|–|—|-)\\s*'+n+'(?:\\D|$)','i').test(p.title))p.title+=' — Page '+n;if(!p.description.endsWith('Page '+n+'.'))p.description+=' Page '+n+'.';}}
  model.metadataRepairs=[...(model.metadataRepairs||[]),...repairDuplicateDescriptions(model.pages)];
  await writeFile(path.join(project,'metadata-repairs.json'),JSON.stringify(model.metadataRepairs,null,2));
  mapWordpress(model);
  await writeFile(path.join(project,'commerce-report.json'),JSON.stringify({schema:'website-cloner-commerce/v1',discovery:model.commerce||null,products:model.pages.filter(p=>p.wordpress?.product).map(p=>({route:p.route,id:p.wordpress.product.id,status:'requires-connection'})),limitations:['Public product data is a captured snapshot; inventory, prices and transactions require an owner-configured service.','Variation references are preserved, not a complete price/stock variation resolver.']},null,2));

  await writeFile(path.join(project,'events-discovery.json'),JSON.stringify(model.events||{schema:'events-discovery/v1',checked:[],issues:[]},null,2));

  // Regeneration can change a captured record's collection (for example a
  // foreign article repaired into an outbound-link page). Retire only files
  // owned by the previous migration manifest, never arbitrary source content.
  const slugs=contentSlugs(model.pages);
  const expected=new Set(model.pages.map((p,i)=>(p.contentType||'pages')+'/'+slugs[i]));
  try{const previous=JSON.parse(await readFile(path.join(project,'routes.json'),'utf8'));
    for(const p of [...previous,...(model.generatedRecordHistory||[])])if(/^[a-z][a-z0-9-]*$/.test(p.collection)&&/^[a-z0-9-]+$/.test(p.slug)&&!expected.has(p.collection+'/'+p.slug)){
      for(const ext of ['md','json','html'])await rm(path.join(project,'content',p.collection,p.slug+'.'+ext),{force:true});
    }
  }catch(error){if(error.code!=='ENOENT')throw error;}

  for (const tax of model.wordpress?.taxonomies || []) {
    const lookup = Object.fromEntries((model.wordpress.terms[tax.slug] || []).map(t => [String(t.id), {name:t.name,slug:t.slug,parent:t.parent,url:t.url}]));
    await writeFile(path.join(project,'content',taxonomyName(tax.slug)+'.yml'),YAML.stringify(lookup));
  }
  await writeFile(path.join(project,'wordpress-mapping.json'),JSON.stringify(model.wordpress || {types:[],terms:{},method:'html-fallback'},null,2));
  const source = new URL(model.source);
  const routes = new Set(model.pages.map((p) => p.route));
  const origins = new Set([source.origin, ...[model.submittedSource].filter(Boolean).map(url => new URL(url).origin)]);
  const routeAliases = new Map();
  for (const route of routes) {
    routeAliases.set(route, route);
    if (route !== '/' && !path.posix.extname(route)) routeAliases.set(route.replace(/\/$/, '') + (route.endsWith('/') ? '' : '/'), route);
  }
  const mediaLinks = new Map((model.media || []).map(m => [m.source, '/' + m.path]));
  const pageURLs = new Map(model.pages.map(p => { const u = new URL(p.url);if(u.searchParams.get('cst')==='')u.searchParams.delete('cst');u.searchParams.sort(); return [u.pathname + u.search, p.route]; }));
  const unavailable = new Map();
  function links(html, base = model.source) {
    const $ = load(html, null, false);
    $("a[href]").each((i, e) => {
      try {
        const href = $(e).attr('href');
        if (href.startsWith('#')||href.startsWith('/assets/media/')) return;
        const u = new URL(href, base);
        const sameHost = ['http:', 'https:'].includes(u.protocol) && u.hostname.replace(/^www\./, '') === source.hostname.replace(/^www\./, '') && !u.port && !source.port;
        if (!origins.has(u.origin) && !sameHost) return;
        if(/^\/(?:rss|feed)(?:\/(?:rss2|atom))?\/?$/.test(u.pathname)&&!u.search){$(e).attr('href','/feed/index.xml');return;}
        if (mediaLinks.has(u.href)) { $(e).attr('href', mediaLinks.get(u.href)); return; }
        // Tracking parameters do not identify a different static document.
        for (const key of [...u.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid|msclkid|replytocom|no-cache)$/i.test(key)) u.searchParams.delete(key);
        if(u.searchParams.get('cst')==='')u.searchParams.delete('cst');
        u.searchParams.sort();
        if(['/feed/','/feed','/feed/index.xml'].includes(u.pathname) && !u.search || u.pathname==='/' && u.search==='?feed=rss2') { $(e).attr('href','/feed/index.xml'); return; }
        const queryRoute = u.search ? pageURLs.get(u.pathname + u.search) : null;
        const route = routes.has(u.pathname) ? u.pathname : routeAliases.get(u.pathname);
        if(route&&u.search&&!staticQuery(u)&&![...u.searchParams.keys()].some(key=>/^(s|q|search|rest_route|feed|mailpoet_router)$/.test(key))){$(e).attr('href',route+u.search+u.hash).attr('data-migration-query','preserved-static-destination');return;}
        if (queryRoute || (route && !u.search)) $(e).attr('href', (queryRoute || route) + u.hash);
        else {
          const destination = u.pathname + u.search + u.hash;
          const dynamic=/^(?:\/(?:wp-admin|wp-login\.php|login|checkout|cart|email-update))(?:\/|$)/.test(u.pathname)||u.searchParams.has('mailpoet_router');
          unavailable.set(base + '\n' + destination, { source: new URL(base).pathname, destination });
          // Do not silently depend on WordPress or create a misleading local 404.
          $(e).removeAttr('href').attr('aria-disabled', 'true').attr('data-migration-unavailable', destination)
            .attr('title', dynamic?'This action requires a backend service.':'This destination was not included in this static export.');
          if(dynamic)$(e).attr('data-migration-dynamic','backend-required');
        }
      } catch {
        $(e).removeAttr("href");
      }
    });
    $('img').each((_,el)=>{const img=$(el),size=dimensions.get(img.attr('src'));
      if(size?.width&&size?.height){const w=Number(img.attr('width')),h=Number(img.attr('height'));if(!w&&!h)img.attr('width',size.width).attr('height',size.height).attr('data-migration-intrinsic-size','');else if(w&&!h)img.attr('height',Math.round(w*size.height/size.width));else if(h&&!w)img.attr('width',Math.round(h*size.width/size.height));}
      if(img.attr('alt')===undefined){const label=img.attr('title')||img.closest('figure').find('figcaption').text().trim();if(label)img.attr('alt',label);else if(img.attr('role')==='presentation'||img.attr('aria-hidden')==='true')img.attr('alt','');}
    });
    return $.html();
  }
  await writeFile(path.join(project,'seo-assets.json'),JSON.stringify((model.media||[]).map(({source,path})=>({source,path})),null,2));
  const families = new Map();
  const productMedia=new Map((model.media||[]).map(m=>[m.source,m.path]));
  model.routes = [];
  for (const [i, p] of model.pages.entries()) {
    validRoute(p.route);
    const collection = p.contentType || "pages";
    await mkdir(path.join(project,"content",collection),{recursive:true});
    const slug = slugs[i];
    model.routes.push({
      source: p.url,
      collection,
      route: p.route,
      slug,
      title: p.title,
      sourceHeadingCount:load(p.shell?p.shell.replace('MIGRATION_CONTENT_SLOT_7c3e',()=>p.content):p.content)('h1').length,
      robots: p.robots,
      canonical: p.canonical,
    });
    const family = p.shell ? `${p.family}-${hash(p.shell).slice(0, 12)}` : p.family;
    if (!families.has(family)) families.set(family, p);
    await writeFile(path.join(project, "assets/css", slug + ".css"), (p.styles || []).map(styled).join("\n"));
    await writeFile(
      path.join(project, "content", collection, slug + ".json"),
      JSON.stringify(
        {
          title: p.title,
          categories: p.taxonomies?.categories || [],
          tags: p.taxonomies?.tags || [],
          taxonomies: Object.fromEntries(Object.entries(p.taxonomies || {}).filter(([k])=>!['categories','tags'].includes(k))),
          date: p.wordpress?.date || '',
          author: p.wordpress?.author || '',
          featured_image: p.featuredImage || '',
          featured_image_width: dimensions.get('/'+p.featuredImage)?.width || 0,
          featured_image_height: dimensions.get('/'+p.featuredImage)?.height || 0,
          favicon: p.favicon || '',
          excerpt: p.wordpress?.excerpt || '',
          last_updated: p.wordpress?.modified || '',
          wordpress_id: p.wordpress?.id || null,
          ...(p.wordpress?.event?{event:p.wordpress.event}:{}),
          custom_fields: p.wordpress?.customFields || {},
          custom_field_schema: p.wordpress?.customFieldSchema || {},
          custom_field_relationships:p.wordpress?.customFieldRelationships||{},
          wordpress_type:p.wordpress?.type||'',
          ...(p.wordpress?.product?{product:localProduct(p.wordpress.product,productMedia,p.sourceHTML||p.content||'',dimensions)}:{}),
          seo_title: p.title,
          ...(p.sourceSEO||captureSEO(load(p.sourceHTML||''))),
          description: p.description,
          lang: p.lang,
          canonical: p.canonical,
          template: family,
          nav_hide: true,
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(project, "content", collection, slug + ".html"),
      links(p.content, p.documentURL||p.url),
    );
  }
  await writeFile(path.join(project, "assets/css/agent.css"), "/* Intrinsic dimensions reserve space without fixing responsive image height. Source selectors retain precedence. */\n:where(img[data-migration-intrinsic-size]){height:auto}\n/* Verified agent repairs are appended here. */\n");
  await writeFile(path.join(project, "motion-manifest.json"), JSON.stringify(model.pages.map(p => ({ route: p.route, ...(p.motion || { schema: "migration-motion/v1", adapters: [], entrances: [], unsupported: [] }) })), null, 2));
  const token = model.design;
  await writeFile(
    path.join(project, "assets/css/design.css"),
    `:root{--sk-color-ink:${token.text};--sk-color-paper:${token.background};--sk-color-blue-600:${token.accent};--migration-width:${token.contentWidth}px;--migration-space:${token.spacing}px} .sk-navigation{font-family:inherit;text-transform:none;letter-spacing:normal;border:0;padding:0;background:transparent}.sk-navigation a{font:inherit;text-transform:none;letter-spacing:normal}h1,h2,h3,h4,h5,h6{font-family:inherit} .migration-notice{padding:1rem;border:1px solid currentColor}img{max-width:100%;height:auto}.migration-fallback{max-width:var(--migration-width);margin:auto;padding:var(--migration-space)}.wp-block-navigation__responsive-container{display:block!important;position:static!important}.wp-block-navigation__container{flex-wrap:wrap!important}.migration-fallback .sk-navigation{display:flex;flex-wrap:wrap;gap:var(--migration-space)}\n`,
  );
  const css = [];
  for (const p of model.pages)
    for (const style of p.styles || [])
      if (!css.includes(style)) css.push(style);
  await writeFile(path.join(project, "assets/css/source.css"), css.join("\n"));
  for (const [family, p] of families) {
    if (p.shell) {
      await writeFile(path.join(project, "templates", `page-${family}.html`), links(p.shell, p.documentURL||p.url).replace("MIGRATION_CONTENT_SLOT_7c3e", "{{body}}"));
      continue;
    }
    const header =
      token.navigation === "source" && p.header
        ? links(p.header, p.documentURL||p.url)
        : `<header class="migration-fallback"><nav class="sk-navigation" aria-label="Primary">${links(model.navigation.map((n) => `<a href="${esc(n.url)}">${esc(n.label)}</a>`).join(""), p.url)}</nav></header>`;
    await writeFile(
      path.join(project, "templates", `page-${family}.html`),
      `<div class="${esc(p.wrapperClass)}">${header}<main id="${esc(p.mainId)}" class="${esc(p.mainClass)}" style="${esc(p.mainStyle)}">{{body}}</main>${links(p.footer, p.documentURL||p.url)}</div>`,
    );
  }
  await writeFile(
    path.join(project, "templates/layout.html"),
    `<!doctype html><html lang="{{lang}}" __HTML_ATTRIBUTES__><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; ${motionCSP} base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{{seo_title}}</title><meta name="description" content="{{meta_description}}">{{canonical_tag}}{{og_image_tag}}<link rel="alternate" type="application/rss+xml" href="/feed/index.xml" title="Latest posts"><meta property="og:title" content="{{seo_title}}"><meta property="og:description" content="{{seo_description}}">{{json_ld}}__PAGE_MOTION____PAGE_STYLES__<link rel="kujo-site-index" href="/.well-known/kujo-site-index.json"><link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable site index"><link rel="migration-search-index" href="/assets/search-index.json"><link rel="stylesheet" href="/assets/css/migration-search.css"><link rel="stylesheet" href="/assets/css/agent.css"></head><body class="__BODY_CLASS__" __BODY_ATTRIBUTES__>{{content}}<script>${navigationRuntime}</script><script>${runtimeSource}</script><script>${searchRuntime}</script><script data-kujo-webmcp>${webmcpRuntime}</script></body></html>`,
  );
  await writeFile(
    path.join(project, "templates/page.html"),
    "<main>{{body}}</main>",
  );
  await writeFile(
    path.join(project, "routes.json"),
    JSON.stringify(
      model.pages.map((p, i) => ({
        ...model.routes[i],
        canonicalRoute: (() => { try { const canonical = new URL(p.canonical); canonical.searchParams.sort(); const target = pageURLs.get(canonical.pathname + canonical.search); return canonical.origin === source.origin && target ? target : p.route; } catch { return p.route; } })(),
        bodyClass: p.bodyClass,
        documentAttributes: p.documentAttributes || documentAttributes(p.sourceHTML),
        family: p.family,
        motion: p.motion || null,
        preservedShell: Boolean(p.shell),
      })),
      null,
      2,
    ),
  );
  await writeFile(
    path.join(project, "navigation.json"),
    JSON.stringify(model.navigation.map(n => { const $ = load(links(`<a href="${esc(n.url)}">${esc(n.label)}</a>`)); return { label: n.label, url: $("a").attr("href") || null }; }), null, 2),
  );
  await writeFile(
    path.join(project, "design.json"),
    JSON.stringify(model.design, null, 2),
  );
  await writeFile(
    path.join(project, "kujo-ssg.json"),
    JSON.stringify(
      {
        site_url: source.origin,
        site_title: model.identity.title,
        site_tagline: "",
        ...(model.events?.clock ? {calendar_clock:model.events.clock} : {}),
        output: "output",
        content: "content",
        templates: "templates",
        assets: "assets",
        fonts: [],
        posts_per_page: 20,
        feed_limit: 20,
        posts_at_root: true,
        no_index: true,
        no_aliases: true,
        minify: false,
        webmcp: true,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(project, "package.json"),
    JSON.stringify(
      {
        name: "your-website",
        private: true,
        type: "module",
        scripts: { build: "node scripts/build.mjs", dev:"node scripts/site.mjs dev", serve:"node scripts/site.mjs serve", new:"node scripts/site.mjs new", check:"node scripts/site.mjs validate", package:"node scripts/site.mjs package", "docs:import":"node scripts/site.mjs docs-import", "docs:starter":"node scripts/site.mjs docs-starter", "ssg:check":"node scripts/site.mjs check-tools" },
        optionalDependencies: {esbuild:"0.28.2"},
      },
      null,
      2,
    ),
  );
  await copyFile(path.join(root,'docs/export-guide.md'),path.join(project,'README.md'));
  await copyFile(path.join(root,'vendor/EXPORT-DEPENDENCIES.txt'),path.join(project,'EXPORT-DEPENDENCIES.txt'));
  await copyFile(
    path.join(root, "vendor/provenance.json"),
    path.join(project, "dependency-lock.json"),
  );
  model.linkCoverage = { unavailable: [...unavailable.values()] };
  await writeFile(path.join(project, 'link-coverage.json'), JSON.stringify(model.linkCoverage, null, 2));
  model.warnings ||= [];
  model.warnings = model.warnings.filter(w => !w.startsWith('Static link coverage:'));
  if (unavailable.size) model.warnings.push(`Static link coverage: ${unavailable.size} internal references were not captured and are disabled; see link-coverage.json. Review discovery failures for inaccessible pages. Dynamic/account destinations need a replacement.`);
  await writeFile(path.join(project,'templates/page-native.html'),'<header><nav data-migration-navigation></nav></header><main class="migration-fallback"><h1>{{title}}</h1>{{body}}</main>');
  await copyFile(path.join(project,'navigation.json'),path.join(project,'navigation-baseline.json'));
  await mkdir(path.join(project,'static'),{recursive:true});
  await exportToolkit(project);
  await writeArchiveBindings(model,project);
  await writeEditableProject(model,project);
  model.metrics.templateCount = model.metrics.contentSource.sharedContentTemplates;
  model.metrics.templateReuseRatio = model.pages.length / Math.max(1,model.metrics.templateCount);
}
