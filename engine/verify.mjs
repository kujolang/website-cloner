import {compareCapturePositions,visualEvidenceFailures} from './visual-evidence.mjs';
import {waitForFonts} from './font-readiness.mjs';
import {verificationScreenshot} from './verify-screenshot.mjs';
import {verifyNavigation} from './verify-navigation.mjs';
import {contentText,contentCoverage} from './content-text.mjs';
import { verifyAgentExport } from './verify-agent-export.mjs';
import { verifyMotion } from './verify-motion.mjs';
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { PNG } from "pngjs";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { serveStatic } from "./static.mjs";
import { measure,viewports,revealLazyContent } from "./capture.mjs";
export function visualScore(a,b){return pixelScore(PNG.sync.read(a),PNG.sync.read(b));}
function pixelScore(a,b){
  if (a.width !== b.width || a.height !== b.height)
    throw Error("Screenshot dimensions differ");
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4)
    for (let c = 0; c < 3; c++) sum += Math.abs(a.data[i + c] - b.data[i + c]);
  return 1 - sum / (a.width * a.height * 3 * 255);
}
// Preserve raw evidence. Only an independently measured invisible overflow and
// a completely blank source-only band qualify for viewport-width comparison.
export function visualComparison(source,rebuilt,{sourceMeasurements,rebuiltMeasurements,viewportWidth}={}){
 const a=PNG.sync.read(source),b=PNG.sync.read(rebuilt),rawDimensions={source:{width:a.width,height:a.height},rebuilt:{width:b.width,height:b.height}};
 if(a.width===b.width&&a.height===b.height)return {score:pixelScore(a,b),normalization:null};
 const overflow=sourceMeasurements?.horizontalOverflow,color=/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(sourceMeasurements?.body?.background||'');
 if(!overflow?.hiddenOnly||overflow.viewportWidth!==viewportWidth||rebuiltMeasurements?.overflow!==false||!color||b.width!==viewportWidth||a.width<=b.width||a.height!==b.height)throw Error('Screenshot dimensions differ');
 const rgb=color.slice(1).map(Number);
 for(let y=0;y<a.height;y++)for(let x=b.width;x<a.width;x++){const i=(y*a.width+x)*4;if(a.data[i+3]!==255||rgb.some((v,c)=>a.data[i+c]!==v))throw Error('Source overflow contains painted pixels; screenshot dimensions differ');}
 const cropped=new PNG({width:b.width,height:a.height});PNG.bitblt(a,cropped,0,0,b.width,a.height,0,0);
 return {score:pixelScore(cropped,b),normalization:{reason:'source-hidden-blank-horizontal-overflow',viewportWidth,rawDimensions}};
}
// Comparable document widths describe overflow extent, not its DOM cause.
export function overflowComparison(source,rebuilt){
 const a=source?.horizontalOverflow,b=rebuilt?.horizontalOverflow;
 const valid=m=>m&&Number.isFinite(m.viewportWidth)&&m.viewportWidth>0&&Number.isFinite(m.scrollWidth)&&m.scrollWidth>=m.viewportWidth;
 if(!valid(a)||!valid(b)||a.viewportWidth!==b.viewportWidth)return {status:'unknown'};
 const sourcePixels=Math.max(0,a.scrollWidth-a.viewportWidth),rebuiltPixels=Math.max(0,b.scrollWidth-b.viewportWidth);
 const status=sourcePixels<=1?(rebuiltPixels<=1?'none':'introduced'):rebuiltPixels<=1?'resolved':Math.abs(sourcePixels-rebuiltPixels)<=1?'matching-extent':rebuiltPixels>sourcePixels?'increased':'reduced';
 return {status,sourcePixels,rebuiltPixels,sourceHiddenOnly:a.hiddenOnly===true,rebuiltHiddenOnly:b.hiddenOnly===true};
}
export function layoutScore(a, b) {
  // Text identifies corresponding boxes; contentCoverage independently checks
  // words. Older captures truncated indentation before normalization, so match
  // their visible prefix only when the saved text hit the 90-character limit.
  const sameText=(x,y)=>{
    const left=x.text.replace(/\s+/g,''),right=y.text.replace(/\s+/g,'');
    return left===right || (Math.min(left.length,right.length)>=12 &&
      (x.text.length===90&&right.startsWith(left)||y.text.length===90&&left.startsWith(right)));
  };
  const used = new Set();
  const scores = [];
  for (const x of a.elements) {
    if (!x.text || x.width === 0) continue;
    const i = b.elements.findIndex(
      (y, i) => !used.has(i) && y.width > 0 && y.tag === x.tag && sameText(x,y),
    );
    if (i < 0) {
      scores.push(0);
      continue;
    }
    used.add(i);
    const y = b.elements[i];
    const error =
      (Math.abs(x.x - y.x) +
        Math.abs(x.y - y.y) +
        Math.abs(x.width - y.width) +
        Math.abs(x.height - y.height)) /
      (Math.max(x.width, 100) + Math.max(x.height, 100) + 1000);
    scores.push(Math.max(0, 1 - error));
  }
  return scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
}
export function verificationPlan(model){
 const saved=model.captures||[],plan=[...saved];
 for(const item of model.capturePlan||[])for(const viewport of viewports)if(!saved.some(c=>c.route===item.route&&c.viewport.name===viewport.name))plan.push({route:item.route,viewport,file:item.role+'-'+viewport.name+'.png',fullPage:true,missingSource:true});
 return plan;
}
export async function verify(model, project, evidence) {
  const start = Date.now();
  await mkdir(path.join(evidence, "rebuilt"), { recursive: true });
  const server = await serveStatic(path.join(project, "output"));
  const report = {
    schema: "migration-report/v1",
    contentMapping: model.contentMapping || null,
    pages: [],
    visual: [],
    warnings: [...model.warnings],
    unsupported: model.pages.flatMap((p) =>
      p.dynamic.map((feature) => ({ route: p.route, feature })),
    ),
    motion: model.pages.map(p => ({ route: p.route, ...(p.motion || {}), visualEquivalence: "not-verified-against-live-motion" })),
    checks: {},
    metrics: model.metrics,
  };
  let manifest=[];
  try { manifest=JSON.parse(await readFile(path.join(project,"routes.json"),"utf8")); } catch(error) { if(error.code!=="ENOENT")throw error; }
  const canonicalRoutes=new Map(manifest.map(p=>[p.route,p.canonicalRoute || p.route]));
  const referenceStatuses = new Map();
  try {
    for (const p of model.pages) {
      const response = await fetch(server.url + p.route);
      const html = await response.text();
      const $ = load(html);
      const contentRoot=p.mainId?$('[id]').filter((_,el)=>$(el).attr('id')===p.mainId).first():$('main').first();
      const text=contentText(contentRoot.length?contentRoot.html():$('body').html());
      const sourceText=p.sourceSemanticText??(p.blocks?.[0]?.html?contentText(p.blocks[0].html):(p.sourceContentText||p.text));
      const coverage=contentCoverage(sourceText,text);
      const sourceDOM=load(p.content||'',null,false),sourceImages=sourceDOM('img[src]').map((_,el)=>sourceDOM(el).attr('src')).get();
      const listCounts=Object.fromEntries(['ol','ul','li'].map(tag=>[tag,{source:sourceDOM(tag).length,rebuilt:(contentRoot.length?contentRoot:$('body')).find(tag).length}]));
      const listsPreserved=Object.values(listCounts).every(count=>count.rebuilt>=count.source);
      const imageCounts=new Map();
      (contentRoot.length?contentRoot:$('body')).find('img[src]').each((_,el)=>{const src=$(el).attr('src');imageCounts.set(src,(imageCounts.get(src)||0)+1);});
      const missingImageSources=sourceImages.filter(src=>{const count=imageCounts.get(src)||0;if(count)imageCounts.set(src,count-1);return !count;});
      const broken = [];
      for (const e of $("a[href],img[src],link[rel=stylesheet]")) {
        const ref = $(e).attr("href") || $(e).attr("src");
        if (!ref?.startsWith("/")) continue;
        const resource = ref.split("#")[0];
        if (!referenceStatuses.has(resource)) {
          const response = await fetch(server.url + resource);
          referenceStatuses.set(resource, response.status);
          await response.body?.cancel();
        }
        if (referenceStatuses.get(resource) !== 200) broken.push(ref);
      }
      const failedImageCounts=new Map();
      for(const source of p.assetFailures||[])failedImageCounts.set(source,(failedImageCounts.get(source)||0)+1);
      report.pages.push({
        route: p.route,
        missingImages: p.assetFailures?.length || 0,
        imageDownloadFailures: [...failedImageCounts].map(([source,occurrences])=>({source,occurrences})),
        imagesPreserved: missingImageSources.length===0,
        listsPreserved,listCounts,
        missingImageSources,
        status: response.status,
        contentCoverage: coverage,
        contentCoverageBasis:p.sourceSemanticText!==undefined?"source-semantic-text":p.blocks?.[0]?.html?"saved-capture-html":"legacy-text",
        sourceArticleCount: p.sourceArticleCount ?? null,
        articleCount: $("article").length,
        articlesPreserved: p.sourceArticleCount == null || $("article").length >= p.sourceArticleCount,
        brokenLinks: [...new Set(broken)],
        title: $("head > title").text() === p.title,
        canonical:
          $("link[rel=canonical]").attr("href") ===
          new URL(model.source).origin + (canonicalRoutes.get(p.route) || p.route),
        description:
          $("meta[name=description]").attr("content")?.trim() === p.description?.trim(),
      });
    }
    const browser = await chromium.launch({
      headless: true,
      channel: process.env.BROWSER_CHANNEL || "chrome",
    });
    try {
      // Independent captures use separate contexts; bound parallelism to avoid
      // multiplying browser memory on large sites while keeping every check.
      const captures=verificationPlan(model);
      const heavy=model.pages.some(p=>Buffer.byteLength((p.content||'')+(p.shell||''))>512_000);
      const concurrency=heavy?1:2;report.metrics.visualConcurrency=concurrency;
      await Promise.all(Array.from({length:Math.min(concurrency,captures.length)},async()=>{
      while(captures.length) {const c=captures.shift();
        const context = await browser.newContext({
          reducedMotion: "reduce",
          viewport: c.viewport,
          serviceWorkers: "block",
        });
        const page = await context.newPage();
        page.setDefaultTimeout(8000);
        const errors = [],
          failures = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("requestfailed", (r) => failures.push(r.url()));
        page.on("response", (r) => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
        await context.route("**/*", (route) =>
          route
            .request()
            .url()
            .startsWith(server.url + "/")
            ? route.continue()
            : route.abort(),
        );
        try {
          await page.goto(server.url + c.route, {
            waitUntil: "networkidle",
            timeout: 15000,
          });
          await waitForFonts(page);
          await revealLazyContent(page);
          const m = await measure(page);
          const file = path.join(evidence, "rebuilt", c.file);
          const screenshot=await verificationScreenshot(page,file,{fullPage:c.fullPage===true});
          let a11y;
          try {
            a11y = (await new AxeBuilder({ page }).analyze()).violations.map(
              (v) => ({ id: v.id, impact: v.impact, count: v.nodes.length, samples:v.nodes.slice(0,3).map(n=>({target:n.target,reason:n.failureSummary})) }),
            );
          } catch (e) {
            a11y = [{ unperformed: e.message }];
          }
          const navigation=await verifyNavigation(page).catch(error=>[{status:'failed',error:error.message}]);
          let pixelSimilarity=null,comparisonNormalization=null,comparisonError=c.missingSource?"Source baseline unavailable; local functional checks still ran":null;
          if(!c.missingSource){try{const compared=visualComparison(await readFile(path.join(evidence,"source",c.file)),await readFile(file),{sourceMeasurements:c.measurements,rebuiltMeasurements:m,viewportWidth:c.viewport.width});pixelSimilarity=compared.score;comparisonNormalization=compared.normalization;}catch(error){comparisonError=error.message;}}
          report.visual.push({
            navigation,
            capturePosition:{source:c.measurements?.scrollPosition??null,rebuilt:m.scrollPosition??null},
            captureAlignment:compareCapturePositions(c.measurements?.scrollPosition,m.scrollPosition),
            route: c.route,
            viewport: c.viewport.name,
            screenshotRetries:screenshot.retries,
            ...(comparisonError?{error:comparisonError}:{}),
            pixelSimilarity,
            comparisonNormalization,
            layoutSimilarity: c.missingSource?null:layoutScore(c.measurements, m),
            measurements: m,
            overflow: m.overflow,
            overflowComparison: overflowComparison(c.missingSource?null:c.measurements,m),
            a11y,
            errors,
            failedResources: failures,
            source: c.file,
            rebuilt: c.file,
          });
        } catch (e) {
          const navigation=await verifyNavigation(page).catch(error=>[{status:'failed',error:error.message}]);
          report.visual.push({
            navigation,
            route: c.route,
            viewport: c.viewport.name,
            error: e.message,
          });
        } finally {
          await context.close();
        }
      }
      }));
      report.visual.sort((a,b)=>(model.captures||[]).findIndex(c=>c.route===a.route&&c.viewport.name===a.viewport)-(model.captures||[]).findIndex(c=>c.route===b.route&&c.viewport.name===b.viewport));
      report.agentDiscovery = await verifyAgentExport(browser, project, server.url);
      report.motionChecks = await verifyMotion(browser, model, server.url, evidence);
    } finally {
      await browser.close();
    }
    report.checks.sitemap =
      (await fetch(server.url + "/sitemap.xml")).status === 200;
    report.checks.robots =
      (await fetch(server.url + "/robots.txt")).status === 200;
    report.metrics.verificationMs = Date.now() - start;
    report.metrics.pagesDiscovered = model.pages.length;
    report.metrics.pagesGenerated = report.pages.filter(
      (p) => p.status === 200,
    ).length;
    report.metrics.routePreservation =
      report.metrics.pagesGenerated / model.pages.length;
    report.metrics.contentCoverage =
      report.pages.reduce((n, p) => n + p.contentCoverage, 0) /
      model.pages.length;
    report.status =
      report.pages.every(
        (p) =>
          p.status === 200 &&
          p.contentCoverage > 0.98 &&
          p.articlesPreserved &&
          p.imagesPreserved && p.listsPreserved &&
          !p.brokenLinks.length &&
          p.title &&
          p.canonical &&
          p.description,
      ) &&
      report.checks.sitemap &&
      report.checks.robots &&
      report.visual.length ===
        (model.capturePlan?.length??Math.min(5,new Set(model.pages.map(p=>p.family)).size))*viewports.length &&
      report.visual.every(
        (v) =>
          !v.error &&
          v.captureAlignment?.status !== 'mismatched' &&
          !v.overflow &&
          !v.errors.length &&
          !v.failedResources.length &&
          !v.a11y.some(
            (a) => a.unperformed || ["serious", "critical"].includes(a.impact),
          ) &&
          v.layoutSimilarity >= 0.85 &&
          v.pixelSimilarity >= 0.9,
      ) &&
      !report.contentMapping?.unresolvedTerms?.length &&
      !report.unsupported.length
        ? "verified-within-scope"
        : "needs-review";
    report.qualityFailures = [];
    report.metrics.stylesWithMissingAssets=Object.keys(model.failedStylesheets||{}).length;
    if(report.metrics.stylesWithMissingAssets)report.qualityFailures.push("Stylesheet assets could not be collected; exported backgrounds or fonts are incomplete.");
    if (model.warnings.some(w => /^Stylesheet .*:|^Stylesheet import unavailable/.test(w)))
      report.qualityFailures.push("Source stylesheets could not be collected; the exported design is incomplete.");
    if(report.visual.some(v=>v.navigation?.some(n=>n.status==='failed')))report.qualityFailures.push("Static navigation failed keyboard or disclosure checks.");
    if (report.agentDiscovery?.status !== "passed") report.qualityFailures.push("WebMCP or llms.txt export checks failed.");
    if (report.motionChecks?.some(check => check.status === "failed"))
      report.qualityFailures.push("Reconstructed motion failed browser checks.");
    if (report.pages.some(p => p.status !== 200 || p.contentCoverage < 0.98 || !p.articlesPreserved || !p.imagesPreserved || !p.listsPreserved || p.brokenLinks.length || p.missingImages > 0))
      report.qualityFailures.push("Content, images, routes or local references failed verification.");
    const expected=(model.capturePlan?.length??Math.min(5,new Set(model.pages.map(p=>p.family)).size))*viewports.length;
    if (report.visual.length !== expected || report.visual.some(v => v.error))
      report.qualityFailures.push("Required visual comparisons are missing or failed.");
    report.qualityFailures.push(...visualEvidenceFailures(report.visual));
    if (report.qualityFailures.length) report.status = "failed-quality-checks";
    return report;
  } finally {
    await server.close();
  }
}
