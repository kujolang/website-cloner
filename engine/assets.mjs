import {backgroundURL} from './deferred-assets.mjs';
import {productAssetURLs} from './commerce.mjs';
import {captureSEO,seoImageURLs} from '../scripts/seo-export.mjs';
import {DownloadQueue} from "./download-queue.mjs";
import {imageSize} from 'image-size';
import { optimizeImage } from "./images.mjs";
import { load } from "cheerio";
import postcss from "postcss";
import safeParser from "postcss-safe-parser";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeSvg } from "./svg.mjs";
import { hash, esc } from "./extract.mjs";
export async function localize(model, network, dir, { stylesOnly = false, linksOnly = false, onCheckpoint = async () => {}, onPage = async () => {}, savedState = {}, concurrency = 8 } = {}) {
  await mkdir(dir, { recursive: true });
  const urls = new Map(model.media.map(media => [media.source, media.path]));
  // Embedded payloads cost no network request; retry them after parser upgrades.
  const failures = new Map((savedState.failures || []).filter(x => x.retryAfter > Date.now() && !x.url.startsWith('data:')).map(x => [x.url, x]));
  const styleCache = new Map(savedState.styles || []);
  let attempts = 0, embeddedBytes = 0, completedPages = 0, cacheHits = 0;
  const started = Date.now();
  const recoverable = error => ["CRAWL_BUDGET", "SOURCE_UNAVAILABLE", "ENOSPC", "DISK_SPACE"].includes(error.code);
  const downloads = new DownloadQueue({concurrency:network.queue?.limit||concurrency,perHost:network.queue?.perHost||concurrency});
  const pending = new Map(), activePages = new Set();
  let lastAssetCheckpoint = 0;
  let stopped;
  async function asset(url) {
    try { const local = new URL(url).pathname.slice(1); if (local.startsWith("assets/media/") && model.media.some(m=>m.path===local)) return local; } catch {}
    if (urls.has(url)) { cacheHits++; return urls.get(url); }
    if (failures.has(url)) { cacheHits++; return null; }
    if (pending.has(url)) return pending.get(url);
    if (stopped) throw stopped;
    const task = downloads.run(url.startsWith("data:")?"embedded":new URL(url).origin,()=>{if(stopped)throw stopped;return download(url);}).catch(error => { if(recoverable(error)) stopped=error; throw error; });
    pending.set(url,task);
    try {
      const result=await task;
      // Large individual pages should publish/cache successful work before the
      // entire page completes, so the last-page phase does not look frozen.
      if(Date.now()-lastAssetCheckpoint>=5000){lastAssetCheckpoint=Date.now();await checkpoint();}
      return result;
    } finally { pending.delete(url); }
  }
  async function download(url) {
    attempts++;
    try {
      let r;
      if (url.startsWith("data:")) {
        const match = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml)|font\/(?:woff2?|ttf|truetype|otf|opentype)|application\/(?:x-)?font-(?:woff2?|ttf|truetype|opentype))(?:;charset=(?:utf-8|us-ascii)|;utf8)?(;base64)?,(.*)$/is.exec(url);
        if (!match || match[3].length > 2_000_000) throw Error("Unsupported embedded media");
        const type = match[1].toLowerCase();
        if (!match[2] && type !== "image/svg+xml") throw Error("Unsupported embedded encoding");
        if (match[2] && !/^[a-zA-Z0-9+/=\s]+$/.test(match[3])) throw Error("Invalid embedded base64");
        r = { status: 200, headers: { "content-type": type }, body: match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3])) };
        embeddedBytes += r.body.length;
        if (embeddedBytes > 20_000_000) throw Error("Embedded media byte budget exhausted");
      } else {
        for(let attempt=0;attempt<3;attempt++){
          try{r=await network.get(url,{maxFile:64_000_000});if(![408,429,500,502,503,504].includes(r.status)||attempt===2)break;}
          catch(error){if(error.retryExhausted||recoverable(error)||attempt===2||!/(?:timeout|deadline|ECONNRESET|EPIPE|socket hang up)/i.test(error.message))throw error;}
          await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
        }
      }
      if (r.status !== 200) throw Error(`HTTP ${r.status}`);
      let type = String(r.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      const exts = {
        "application/pdf": "pdf",
        "image/svg+xml": "svg",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/avif": "avif",
        "image/x-icon":"ico",
        "image/vnd.microsoft.icon":"ico",
        "font/woff2": "woff2",
        "font/woff": "woff",
        "application/font-woff": "woff",
        "application/font-woff2": "woff2",
        "application/x-font-woff2": "woff2",
        "application/font-ttf": "ttf",
        "font/ttf": "ttf",
        "font/truetype": "ttf",
        "application/font-truetype": "ttf",
        "application/font-opentype": "otf",
        "font/otf": "otf",
        "font/opentype": "otf",
        "application/x-font-ttf": "ttf",
        "application/x-font-truetype": "ttf",
        "application/x-font-opentype": "otf",
        "application/x-font-woff": "woff",
        "application/vnd.ms-fontobject": "eot",
      };
      if(type==='image/jpg')type='image/jpeg';
      if(type==='image/x-png')type='image/png';
      if(type==='application/octet-stream'||type==='binary/octet-stream'||type==='application/font-sfnt'){
        const signature=r.body.subarray(0,4).toString('ascii');
        if(signature==='%PDF')type='application/pdf';
        let inferred;try{inferred=imageSize(r.body).type;}catch{}
        if(['png','jpg','gif','webp','avif','svg'].includes(inferred))type='image/'+(inferred==='jpg'?'jpeg':inferred==='svg'?'svg+xml':inferred);
        type=signature==='wOF2'?'font/woff2':signature==='wOFF'?'font/woff':signature==='OTTO'?'font/otf':r.body.subarray(0,4).equals(Buffer.from([0,1,0,0]))?'font/ttf':type;
      }
      let ext = exts[type];
      if (!ext) throw Error(`Unsupported media ${type}`);
      if(ext === "pdf" && !r.body.subarray(0,1024).includes(Buffer.from("%PDF-")))throw Error("Invalid PDF signature");
      if (ext === "svg") r.body = Buffer.from(sanitizeSvg(r.body.toString()));
      const originalBytes = r.body.length;
      const optimized = await optimizeImage(r.body, type);
      r.body = optimized.body; type = optimized.type; ext = exts[type];
      const name = hash(r.body).slice(0, 20) + "." + ext;
      await writeFile(path.join(dir, name), r.body);
      const local = "assets/media/" + name;
      urls.set(url, local);
      let dimensions={};try{const size=imageSize(r.body);dimensions={width:size.width,height:size.height};}catch{}
      model.media.push({
        ...dimensions,
        source: url,
        path: local,
        bytes: r.body.length,
        originalBytes, optimization: optimized.status,
        sha256: hash(r.body),
        type,
      });
      return local;
    } catch (e) {
      // Pause this attempt normally, but do not restart the same exhausted
      // optional-asset download on every resume. Never cache another request's
      // shared outage, DNS/permission uncertainty, or server rate limiting.
      if(e.code==='SOURCE_UNAVAILABLE' && e.retryExhausted && e.failedURL===url && ['idle','deadline'].includes(e.timeoutKind)) {
        failures.set(url,{url,error:e.message,retryAfter:Date.now()+300_000});
        model.warnings.push(`Asset ${url.slice(0,180)}: ${e.message}`);
      }
      if (recoverable(e)) throw e;
      urls.set(url, null);
      failures.set(url, {url, error:e.message, retryAfter:Date.now() + 300_000});
      model.warnings.push(`Asset ${url.slice(0, 180)}: ${e.message}`);
      return null;
    }
  }
  async function css(text, base, depth = 0, visited = new Set(), owner = base) {
    let missingAsset=false;
    let root;
    try {
      root = postcss.parse(text, { map: false });
    } catch {
      root = safeParser(text);
      model.warnings.push(`Recovered malformed stylesheet: ${base}`);
    }
    const imports = [];
    root.walkAtRules("import", (rule) => imports.push(rule));
    for (const rule of imports) {
      const match = /^(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)"']+))\s*\)|"([^"]+)"|'([^']+)')\s*(.*)$/i.exec(rule.params);
      try {
        if (!match || depth >= 4) throw Error("Unsupported CSS import");
        const url = new URL(match.slice(1,6).find(Boolean), base).href;
        if (visited.has(url)) throw Error("CSS import cycle");
        const imported = await css(await network.text(url), url, depth + 1, new Set([...visited, url]),owner);
        rule.replaceWith(postcss.parse(match[6] ? `@media ${match[6]}{${imported}}` : imported));
      } catch (error) { if (recoverable(error)) throw error; rule.remove(); model.warnings.push("Stylesheet import unavailable: "+base+" — "+error.message); }
    }
    root.walkAtRules((r) => {
      if (
        ![
          "media",
          "supports",
          "font-face",
          "keyframes",
          "layer",
          "container",
          "scope",
          "starting-style",
          "property",
        ].includes(r.name.toLowerCase())
      )
        r.remove();
    });
    const declarations = [];
    root.walkDecls((d) => declarations.push(d));
    for (const d of declarations) {
      const iconGlyph=d.prop.toLowerCase()==='content' && /^(['"])(?:\\[a-f\d]{1,6}\s?)+\1$/i.test(d.value);
      if (/expression|javascript|behavior|-moz-binding|image-set\(/i.test(d.value) || (d.value.includes('\\')&&!iconGlyph)) {
        d.remove();
        continue;
      }
      let value = d.value;
      const matches = [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)];
      for (const m of matches) {
        try {
          if (/^#[a-zA-Z_][a-zA-Z0-9_-]*$/.test(m[2])) continue;
          if (!m[2].trim()) { value=value.replace(m[0],'none');continue; }
          if (/^\.\.\/media\/[a-f0-9]{20}\.[a-z0-9]+$/.test(m[2])) continue;
          const local = await asset(new URL(m[2], base).href);
          if(!local)missingAsset=true;
          value = value.replace(
            m[0],
            local ? `url("../${local.slice(7)}")` : "none",
          );
        } catch (error) {
          if (recoverable(error)) throw error;
          value = value.replace(m[0], "none");
        }
      }
      d.value = value;
    }
    const localized=root.toString();
    if(missingAsset){model.failedStylesheets ||= {};model.failedStylesheets[hash(owner+base+text)]={base,owner,source:text,localized};}
    return localized;
  }
  const cssMap = new Map();
  let checkpointQueue=Promise.resolve();
  const checkpoint=(donePage)=>{
    // Serialize writes and snapshot only when the preceding write has completed.
    checkpointQueue=checkpointQueue.then(async()=>{
      await onCheckpoint(model.media, {completedPages,totalPages:model.pages.length,activePages:[...activePages],pendingAssets:pending.size,attempts,cacheHits,assets:model.media.length,failedAssets:failures.size,activeDownloads:network.queue?.active||0,queuedDownloads:network.queue?.pending.length||0,retries:network.retries||0,downloadBytes:network.bytes||0,bytesPerSecond:Math.round((network.bytes||0)/Math.max(1,(Date.now()-started)/1000)),concurrency:Math.max(1,Math.min(8,Math.floor(Number(concurrency)||8)))}, {failures:[...failures.values()],styles:[...styleCache]});
      if(donePage) await onPage(donePage);
    });
    return checkpointQueue;
  };
  async function page(p) {
    if (!stylesOnly && !linksOnly && p.assetCheckpointVersion === 2 && (!p.wordpress?.product || p.productAssetsLocalized === 3)) { completedPages++; return; }
    activePages.add(p.route||p.url);
    if (!stylesOnly && !linksOnly) {
      // Schedule independent responsive images together, before rewriting the DOM.
      const candidates = new Set(seoImageURLs(p.sourceSEO||captureSEO(load(p.sourceHTML||'')),p.documentURL||p.url));
      for (const part of ["content","header","footer",...(p.shell?["shell"]:[])]) {
        if (typeof p[part] !== "string") continue;
        const $ = load(p[part], null, false);
        for (const e of $("img,picture source")) {
          const raw = [$(e).attr("src"), ...($(e).attr("srcset")||"").split(/,\s*(?=(?:https?:|\/|\.))/).map(x=>x.trim().split(/\s+/)[0])];
          for (const value of raw.filter(Boolean)) {
            if(value.startsWith("/assets/media/"))continue;
            try { candidates.add(new URL(value,p.documentURL||p.url).href); } catch {}
          }
        }
      }
      for(const url of productAssetURLs(p.wordpress?.product,p.sourceHTML||p.content||''))candidates.add(url);
      const list=[...candidates];let cursor=0, failure;
      await Promise.all(Array.from({length:Math.min(6,list.length)},async()=>{
        while(cursor<list.length&&!failure&&!stopped) {
          try { await asset(list[cursor++]); } catch(error) { failure=error; }
        }
      }));
      if(failure)throw failure;
    }
    if (!stylesOnly && !linksOnly) p.assetFailures = [];
    if (!stylesOnly && !linksOnly && p.faviconSource) { try { p.favicon=await asset(new URL(p.faviconSource,p.documentURL||p.url).href); } catch(error){if(recoverable(error))throw error;} }
    if (!stylesOnly && !linksOnly && p.wordpress?.featuredImage) p.featuredImage = await asset(p.wordpress.featuredImage);
    for (const part of (stylesOnly ? [] : ["content", "header", "footer", ...(p.shell ? ["shell"] : [])])) {
      if(typeof p[part]!=='string')continue;
      const $ = load(p[part], null, false);
      for(const e of $('a[href]')){
        try{if(($(e).attr('href')||'').startsWith('/assets/media/'))continue;const url=new URL($(e).attr('href'),p.documentURL||p.url);
          const origin=new URL(model.source);
          const sameSite=url.origin===origin.origin||(['http:','https:'].includes(url.protocol)&&!url.port&&!origin.port&&url.hostname.replace(/^www\./,'')===origin.hostname.replace(/^www\./,''));
          if(!sameSite||! /\.(?:pdf|png|jpe?g|webp|gif|avif|svg)$/i.test(url.pathname))continue;
          const fragment=url.hash;url.hash='';const local=await asset(url.href);if(local)$(e).attr('href','/'+local+fragment);
        }catch(error){if(recoverable(error))throw error;}
      }
      if(linksOnly){p[part]=$.html();continue;}
      for (const e of $("img,picture source")) {
        // Freeze responsive candidates locally; retain their descriptors/media.
        const candidates = ($(e).attr("srcset") || "").split(/,\s*(?=(?:https?:|\/|\.))/).map(x => x.trim()).filter(Boolean);
        const localized = [];
        // Keep every responsive candidate; resource checkpoints bound the work without dropping variants.
        const selected = [...new Set(candidates)];
        for (const candidate of selected) {
          const [src, descriptor] = candidate.split(/\s+/);
          try { const local = await asset(new URL(src, p.documentURL||p.url).href);
            if (local) localized.push("/" + local + (descriptor ? " " + descriptor : ""));
          } catch (error) { if (recoverable(error)) throw error; }
        }
        $(e).removeAttr("srcset");
        if (localized.length) { $(e).attr("srcset", localized.join(", ")); if(e.tagName === "source") $(e).removeAttr("type"); }

        const src = $(e).attr("src");
        if (!src) continue;
        let local;
        try {
          local = await asset(new URL(src, p.documentURL||p.url).href);
        } catch (error) { if (recoverable(error)) throw error; }
        if (local) $(e).attr("src", "/" + local);
        else if (localized.length) $(e).attr("src", localized[0].split(/\s+/)[0]);
        else {
          p.assetFailures.push(src);
          $(e).replaceWith(
            `<span class="missing-image">${esc($(e).attr("alt") || "Image unavailable")}</span>`,
          );
        }
      }
      for (const e of $('[data-background-image],[data-bg],[data-bg-src]')) {
        const node=$(e),raw=node.attr('data-background-image')||node.attr('data-bg')||node.attr('data-bg-src');
        try { const target=backgroundURL(raw,p.documentURL||p.url);if(!target)continue;
          const local=await asset(target);if(local){node.attr('style',(node.attr('style')||'')+';background-image:url("/'+local+'")');node.removeAttr('data-background-image').removeAttr('data-bg').removeAttr('data-bg-src');}
        }catch(error){if(recoverable(error))throw error;}
      }
      for (const e of $("video")) {
        const poster = $(e).attr("poster") || $(e).find("img").first().attr("src");
        let local;
        if (poster?.startsWith("/assets/media/")) local = poster.slice(1);
        else if (poster) { try { local = await asset(new URL(poster, p.documentURL||p.url).href); } catch (error) { if (recoverable(error)) throw error; } }
        $(e).removeAttr("poster");
        $(e).find("source").remove();
        if (local) $(e).attr("poster", "/" + local);
      }
      p[part] = $.html();
    }
    p.blocks = [{ type: "html", html: p.content }];
    if(linksOnly){activePages.delete(p.route||p.url);completedPages++;await checkpoint();return;}
    p.styles = [];
    for (const entry of p.styleSources || [...p.css.map(url => ({ url })), ...p.inlineCss.map(text => ({ text }))]) {
      const cached=p.cachedStyles?.[JSON.stringify(entry)];if(cached){p.styles.push(cached);continue;}
      if (entry.url && styleCache.has(entry.url)) { cssMap.set(entry.url, Promise.resolve(styleCache.get(entry.url))); }
      if (entry.url && !cssMap.has(entry.url)) {
        cssMap.set(entry.url, (async()=>{
          try {
            const text = await css(await network.text(entry.url), entry.url);
            const prefix = `Stylesheet ${entry.url}:`;
            for (let i = model.warnings.length - 1; i >= 0; i--) {
              if (model.warnings[i].startsWith(prefix)) model.warnings.splice(i, 1);
            }
            styleCache.set(entry.url, text);
            return text;
          }
          catch(e){if(recoverable(e))throw e;model.warnings.push(`Stylesheet ${entry.url}: ${e.message}`);return '';}
        })());
      }
      const text = entry.url ? await cssMap.get(entry.url) || "" : await css(entry.text, p.documentURL||p.url,0,new Set(),entry.text);
      const media = entry.media;
      p.styles.push(media && media !== "all" && /^[a-zA-Z0-9\s():.,%_\/-]+$/.test(media) ? `@media ${media}{${text}}` : text);
    }
    delete p.cachedStyles;
    activePages.delete(p.route||p.url);
    completedPages++;
    if(!stylesOnly&&!linksOnly){p.assetCheckpointVersion=2;if(p.wordpress?.product)p.productAssetsLocalized=3;}
    await checkpoint(p);
  }
  let cursor=0;
  const workers=Array.from({length:Math.max(1,Math.min(8,Math.floor(Number(concurrency)||4)))},async()=>{
    while(cursor<model.pages.length&&!stopped){const p=model.pages[cursor++];try{await page(p);}catch(error){stopped=error;}}
  });
  await Promise.all(workers);
  await checkpoint();
  if(stopped)throw stopped;
  const resolved = model.media.map(media => `Asset ${media.source.slice(0, 180)}:`);
  model.warnings = [...new Set(model.warnings.filter(warning => !resolved.some(prefix => warning.startsWith(prefix))))];
  model.metrics.imageOptimization = { optimized: model.media.filter(m=>m.optimization === "optimized").length, bytesSaved: model.media.reduce((n,m)=>n + (m.originalBytes || m.bytes)-m.bytes,0), fallbacks: model.media.filter(m=>m.optimization === "encoder-unavailable-or-failed").length };
  model.metrics.assetRequests = attempts;
  model.metrics.assetsLocalized = model.media.length;
  model.metrics.missingImages = model.pages.reduce((sum, page) => sum + (page.assetFailures?.length || 0), 0);
}
