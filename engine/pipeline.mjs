import {saveCaptureProgress,restoreCaptureProgress,clearCaptureProgress} from './capture-progress.mjs';
import {withoutRedirectCopies} from './redirect-pages.mjs';
import {checkDiskSpace} from './disk-space.mjs';
import {repairSavedModel} from './repair.mjs';
import { optimizeSavedMedia } from './images.mjs';
import { aiPolicy } from './ai-policy.mjs';
import { summarizeUsage, initializeUsage } from './usage.mjs';
import { auditProject, writeAudit } from './audit.mjs';
import { packageProject, validatePreparedOutput } from './recovery.mjs';
import { mkdir, writeFile, readFile, rm, cp } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {BrowserNetwork,captureTransport} from "./browser-network.mjs";
import { SafeNetwork, normalize } from "./network.mjs";
import { discover, hash } from "./extract.mjs";
import { capture,missingCaptureSamples } from "./capture.mjs";
import {cachedCaptureNetwork} from './capture-cache.mjs';
import { localize } from "./assets.mjs";
import { reconstruct } from "./reconstruct.mjs";
import { generate } from "./generate.mjs";
import { repairWithAgent } from "./agent.mjs";
import { verify } from "./verify.mjs";
const execute=promisify(execFile);
export async function run(...args){
 try{return await execute(...args);}catch(error){
  // execFile reports an exit status for a child filesystem failure. Preserve
  // the recoverable disk condition for the same-job automatic-resume loop.
  if(/(?:Error: |code: ['"])?ENOSPC(?:: no space left on device|['"])/.test(error.stderr||''))error.code='ENOSPC';
  throw error;
 }
}
export {writeJSON as json} from './json.mjs';
import {writeJSON as json,readJSON} from './json.mjs';
export async function migrate(
  url,
  dir,
  { fixtureOrigins = [], maxPages = null, sampleUrls = null, event = () => {}, ai = {}, agent = null, aiEnabled = false, resume = false, rebuild = false, retryAssets = true, transport = "http", browserConfirm } = {},
) {
  ({ ai, agent } = aiPolicy({ aiEnabled, ai, agent }));
  dir = path.resolve(dir);
  const start = Date.now();
  const source = normalize(url).href;
  await mkdir(dir, { recursive: true });
  const project = path.join(dir, "project"),
    evidence = path.join(dir, "evidence");
  await mkdir(project, { recursive: true });
  let model;
  const checkpoint = async (stage) => {
    await checkDiskSpace(dir,{model,phase:stage==="Preparing download"?"package":/Optimizing|Rebuilding|Generating/.test(stage)?"build":"collect"});
    event(stage);
    await json(path.join(dir, "checkpoint.json"), {
      stage,
      source,
      updatedAt: new Date().toISOString(),
    });
  };
  captureTransport(transport);
  const network = new (transport === "browser" ? BrowserNetwork : SafeNetwork)({
    event, confirm:browserConfirm, sourceOrigin:source,
    fixtureOrigins, maxRequests: Infinity, maxBytes: Infinity, maxDurationMs: Infinity, pauseOnOutage: true,
    concurrency: Number(process.env.CLONER_DOWNLOAD_CONCURRENCY) || 12,
    perHost: Number(process.env.CLONER_HOST_CONCURRENCY) || 6,
  });
  try {
  if(transport === "browser")await network.initialize(source);
  const readCheckpoint = async file => {
    try { return await readJSON(path.join(dir, file)); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  };
  const savedUsage = resume ? await readCheckpoint('ai-usage.json') : null;
  const onUsage = async rounds => {
    const receipt = { schema: 'ai-usage/v1', rounds, totals: summarizeUsage(rounds), note: 'Provider-reported tokens; cached input is included in input, not additional. Unknown fields are null. API-equivalent pricing is not a ChatGPT subscription bill.' };
    await json(path.join(dir, 'ai-usage.json'), receipt);
    await json(path.join(project, 'ai-usage.json'), receipt);
    event('AI usage updated', { aiUsage: receipt });
  };
  const prior = resume ? await readCheckpoint('checkpoint.json') : null;
  if (resume && prior && prior.source !== source) throw Error('No matching migration checkpoint to resume');
  if (resume && !rebuild && prior?.stage === 'Preparing download') {
    const report = await readCheckpoint('report.json');
    model = await readCheckpoint('project/site-model.json');
    const archivedReport = await readCheckpoint('project/migration-report.json');
    if (model && report?.pages?.length && JSON.stringify(report) === JSON.stringify(archivedReport)) {
      let outputReady = true;
      try { await validatePreparedOutput(dir, report); }
      catch { outputReady = false; }
      if (outputReady) {
        event('Resuming download packaging');
        await checkDiskSpace(dir,{model,phase:'package'});
        await packageProject(dir);
        return { model, report, project, evidence };
      }
      event('Saved output is incomplete; rebuilding from checkpoint');
    }
  }
  // Prepared snapshots avoid downloading media again. A captured snapshot avoids recrawling pages.
  if(rebuild)event('Loading saved capture for rebuild');
  model = resume ? await readCheckpoint('prepared-model.json') : null;
  if(rebuild&&!model)throw Error('Cached rebuild requires a prepared snapshot; resume the incomplete migration first.');
  if (!model) {
    model = resume ? await readCheckpoint('captured-model.json') : null;
    let previousRequests = model?.metrics?.networkRequests || 0;
    let previousBytes = model?.metrics?.downloadBytes || 0;
    if (!model) {
      const captureSession=resume?await readCheckpoint('capture-session.json'):null;
      const resumeCapture=captureSession?.source===source&&captureSession?.maxPages===maxPages;
      await checkpoint(resumeCapture?"Restoring design capture checkpoints":"Inspecting website");
      if(resumeCapture){model=await readCheckpoint('discovery-model.json');if(!model||model.source!==captureSession.modelSource)throw Error('Missing matching discovery checkpoint for capture resume');const restored=await restoreCaptureProgress(model,dir);previousRequests=model.metrics.networkRequests||0;previousBytes=model.metrics.downloadBytes||0;event('Restored design capture checkpoints',{pages:restored});}
      else model = await discover(source, network, { maxPages, sampleUrls, onEvent: event, state: resume ? await readCheckpoint("discovery-model.json") : null, onCheckpoint: async snapshot => { await json(path.join(dir, "discovery-model.json"), snapshot);const c=snapshot.crawl;await json(path.join(dir,'resume-progress.json'),{pages:snapshot.pages.length,seen:c.seen.length,rest:c.rest,restDone:c.restDone,sitemaps:c.sitemapSeen.length,queued:c.queue.length});await checkDiskSpace(dir,{model:snapshot,phase:'collect'}); } });
      if (!model.pages.length) throw Error("No accessible pages found");
      await checkpoint("Understanding design");
      await json(path.join(dir,'capture-session.json'),{source,modelSource:model.source,maxPages});
      await capture(model, network, path.join(evidence, "source"),{onEvent:event,resume:resumeCapture,onCheckpoint:page=>saveCaptureProgress(model,page,dir,{networkRequests:previousRequests+network.requests,downloadBytes:previousBytes+network.bytes})});
      for(const [origin,error] of network.externalFailures)model.warnings.push(`External resources skipped for ${origin}: ${error.message}`);
      model.metrics.networkRequests = previousRequests + network.requests;
      model.metrics.downloadBytes = previousBytes + network.bytes;
      await json(path.join(dir, "captured-model.json"), model);
      await clearCaptureProgress(dir);
    } else event('Resuming saved page capture');
    if (savedUsage) model.metrics.aiUsage = savedUsage.rounds;
    const assetCache = resume ? await readCheckpoint('asset-cache.json') : null;
    if (assetCache) { model.media = assetCache.media; model.failedStylesheets={...(model.failedStylesheets||{}),...(assetCache.failedStylesheets||{})};model.warnings.push(...(assetCache.warnings||[]).filter(w=>!model.warnings.includes(w))); }
    network.pauseOnOutage = true;
    const pageCache = path.join(dir, "localized-pages");
    await mkdir(pageCache, {recursive:true});
    if(resume) {
      for(let i=0;i<model.pages.length;i++) {
        const saved = await readCheckpoint("localized-pages/"+hash(model.pages[i].url)+".json");
        // The file envelope stays v1; v2 pages are complete, while v1 pages need an asset upgrade.
        if(saved?.version===1 && saved.page?.url===model.pages[i].url && saved.page.route===model.pages[i].route && [1,2].includes(saved.page.assetCheckpointVersion)) {
          model.pages[i]=saved.page;
          model.warnings.push(...(saved.warnings||[]).filter(w=>!model.warnings.includes(w)));
        }
      }
    }
    await checkpoint("Collecting images");
    let lastAssetProgress = 0;
    let lastDownloadState = assetCache?.downloadState || {};
    let lastAssetProgressSnapshot;
    const saveAssets = async (media, progress, downloadState) => {
      if(downloadState) lastDownloadState=downloadState;
      if(progress) lastAssetProgressSnapshot=progress;
      await json(path.join(dir, 'asset-cache.json'), { media, progress:lastAssetProgressSnapshot, downloadState:lastDownloadState, failedStylesheets:model.failedStylesheets||{}, warnings:model.warnings, updatedAt:new Date().toISOString() });
      if(progress && Date.now()-lastAssetProgress>10000){
        lastAssetProgress=Date.now();
        await checkDiskSpace(dir,{model,phase:"collect"});
        event(`Collecting images: ${progress.assets} saved; ${progress.completedPages}/${progress.totalPages} pages processed`, {assetProgress:progress});
      }
    };
    try { await localize(model, network, path.join(project, "assets/media"), { onCheckpoint: saveAssets, savedState:lastDownloadState, onPage: async page => {
      await json(path.join(pageCache,hash(page.url)+".json"),{version:1,page});
    } }); }
    catch (error) { if (error.code === 'CRAWL_BUDGET') error.message = 'Asset collection paused at a resource safety boundary. Resume to continue using saved downloads.'; throw error; }
    finally { await saveAssets(model.media); }
    await checkpoint("Rebuilding templates");
    await reconstruct(model, { ...ai, onUsage, screenshotDir: path.join(evidence, "source") });
    model.metrics.networkRequests = previousRequests + network.requests;
    model.metrics.downloadBytes = previousBytes + network.bytes;
    await json(path.join(dir, 'prepared-model.json'), model);
  } else { if (savedUsage) model.metrics.aiUsage = savedUsage.rounds; event('Resuming saved content and images'); }
  if(rebuild){model=await repairSavedModel(model,dir,network,event,{retryAssets});await json(path.join(dir,'prepared-model.json'),model);}
  if(rebuild){
    const savedCapture=await readCheckpoint('captured-model.json');
    if(savedCapture){
      const routes=new Set(model.pages.map(p=>p.route)),sourceModel={...model,pages:savedCapture.pages.filter(p=>routes.has(p.route))};
      const missing=await missingCaptureSamples(sourceModel,path.join(evidence,'source'));
      model.capturePlan=missing.planned.map(p=>({route:p.route,role:p.captureRole,components:p.captureComponents}));
      if(missing.samples.length){
        event('Completing missing source comparisons',{pages:missing.samples.length});
        const assets=await readCheckpoint('asset-cache.json'),cachedNetwork=cachedCaptureNetwork(network,sourceModel.pages,assets?.media||model.media,project),before=missing.valid.length,requests=network.requests,bytes=network.bytes;
        await capture(sourceModel,cachedNetwork,path.join(evidence,'source'),{supplement:true,evidenceOnly:true,onEvent:event});
        model.captures=sourceModel.captures;model.capturePlan=sourceModel.capturePlan;
        model.metrics.sourceCaptureCoverage={plannedPages:missing.planned.length,reusedCaptures:before,addedCaptures:sourceModel.captures.length-before,cache:cachedNetwork.stats,requests:network.requests-requests,downloadBytes:network.bytes-bytes};
        model.metrics.networkRequests=(model.metrics.networkRequests||0)+network.requests-requests;model.metrics.downloadBytes=(model.metrics.downloadBytes||0)+network.bytes-bytes;
      }
    }
  }
  model = withoutRedirectCopies(model);
  initializeUsage(model);
  await checkpoint("Optimizing images");
  await optimizeSavedMedia(model, project);
  await json(path.join(dir, "prepared-model.json"), model);
  await checkpoint("Rebuilding templates");
  await generate(model, project);
  await json(path.join(project, "site-model.json"), model);
  await checkpoint("Generating website");
  const build = await run(process.execPath, ["scripts/build.mjs"], {
    cwd: project,
    timeout: 660000,
    maxBuffer: 2e6,
  });
  await writeFile(path.join(dir, "build.log"), build.stdout + build.stderr);
  await run(process.execPath,["scripts/site.mjs","validate"],{cwd:project,timeout:120000,maxBuffer:2e6});
  const cleanupBuild = async () => {
    model.linkCoverage=JSON.parse(await readFile(path.join(project,'link-coverage.json'),'utf8'));
    model.warnings=model.warnings.filter(w=>!w.startsWith('Static link coverage:'));
    if(model.linkCoverage.unavailable.length)model.warnings.push(`Static link coverage: ${model.linkCoverage.unavailable.length} internal references remain unavailable; see link-coverage.json. Dynamic/account destinations need a replacement.`);
    for (const name of ['.ssg-output', '.ssg-content', '.ssg-templates']) await rm(path.join(project, name), {recursive:true,force:true});
  };
  await cleanupBuild();
  await checkpoint("Checking the results");
  let report = await verify(model, project, evidence);
  // One conservative repair: reflow oversized media/long words, then retest all checks.
  if (model.pages.some(p => !p.shell) && report.visual.some((v) => v.overflow)) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(
      path.join(project, "assets/css/design.css"),
      "\nmain{overflow-wrap:anywhere}main img,main video,main table{max-width:100%}main pre{white-space:pre-wrap}\n",
    );
    model.metrics.repairIterations = 1;
    await json(path.join(dir, "repair-before.json"), report);
    await run(process.execPath, ["scripts/build.mjs"], {
      cwd: project,
      timeout: 660000,
    });
    await cleanupBuild();
    report = await verify(model, project, evidence);
    report.repairs = [
      {
        attempt: 1,
        change: "Constrain media and wrap long content",
        retested: true,
      },
    ];
  }
  if (agent) {
    await json(path.join(dir,'pre-ai-report.json'),report);
    await cp(path.join(evidence,'rebuilt'),path.join(evidence,'pre-ai'),{recursive:true});
    report = await repairWithAgent(model, project, report, {
      selection: agent, event, onUsage,
      rebuild: async () => { const result = await run(process.execPath, ["scripts/build.mjs"], { cwd: project, timeout: 660000, maxBuffer: 2e6 }); await cleanupBuild(); return result; },
      inspect: () => verify(model, project, evidence),
    });
  }
  model.metrics.aiEnabled = aiEnabled;
  model.metrics.resumed = resume;
  model.metrics.attemptNetworkRequests = network.requests;
  model.metrics.attemptDownloadBytes = network.bytes;
  model.metrics.elapsedMs = Date.now() - start;
  model.metrics.networkRequests ??= network.requests;
  model.metrics.downloadBytes ??= network.bytes;
  model.metrics.totalEstimatedCostUSD =
    process.env.COMPUTE_USD_PER_HOUR && model.metrics.inferenceCostUSD !== null
      ? (model.metrics.elapsedMs / 3600000) *
          Number(process.env.COMPUTE_USD_PER_HOUR) +
        model.metrics.inferenceCostUSD
      : null;
  report.metrics = {
    ...model.metrics,
    ...report.metrics,
    elapsedMs: model.metrics.elapsedMs,
    networkRequests: model.metrics.networkRequests,
    downloadBytes: model.metrics.downloadBytes,
    totalEstimatedCostUSD: model.metrics.totalEstimatedCostUSD,
  };
  const substitutions=[...network.publicPackageSubstitutions.values()];
  report.publicPackageSubstitutions=substitutions;
  if(substitutions.length)report.warnings.push(`${substitutions.length} versioned public dependency resources used an allowed npm distribution; see publicPackageSubstitutions.`);
  report.captureTransport = transport;
  report.discovery = model.discovery;
  report.aiUsage = { schema: 'ai-usage/v1', rounds: model.metrics.aiUsage || [], totals: summarizeUsage(model.metrics.aiUsage || []) };
  await onUsage(report.aiUsage.rounds);
  if (model.discovery.complete === false && report.status === 'verified-within-scope') report.status = 'needs-review';
  await checkpoint('Checking SEO and performance');
  const audit = await auditProject(project);
  await writeAudit(audit, path.join(project, 'audit'));
  if (process.env.LIGHTHOUSE_AUDIT === '1') {
    try {
      await run(process.execPath, [new URL('../scripts/lighthouse.mjs', import.meta.url).pathname, project, path.join(project, 'audit/lighthouse')], { timeout: 240000, maxBuffer: 2e6 });
      audit.lighthouse = 'completed; raw desktop/mobile reports in audit/lighthouse';
    } catch (error) { audit.lighthouse = 'not completed: ' + error.message; report.warnings.push('The optional Lighthouse audit did not complete. See audit results.'); }
    await writeAudit(audit, path.join(project, 'audit'));
  }
  report.audit = { status: audit.status, ...audit.summary, unavailable: audit.unavailable };
  if (audit.status === 'BLOCKED') { report.qualityFailures.push('Post-build audit found blocking issues.'); report.status = 'failed-quality-checks'; }
  else if (audit.issues.length && report.status === 'verified-within-scope') report.status = 'needs-review';
  await json(path.join(project, "site-model.json"), model);
  await json(path.join(project, "migration-report.json"), report);
  await json(path.join(dir, "report.json"), report);
  await writeFile(
    path.join(dir, "report.md"),
    `# Migration report\n\nStatus: **${report.status}**. ${report.metrics.pagesGenerated}/${report.metrics.pagesDiscovered} captured pages generated. Capture mode: ${maxPages == null ? "whole site" : "explicit sample"}; ${model.discovery.queued} queued URLs; ${model.discovery.failures?.length || 0} inaccessible destinations.\n\n${report.pages.map((p) => `- ${p.route}: HTTP ${p.status}, text token coverage ${(p.contentCoverage * 100).toFixed(1)}%, ${p.brokenLinks.length} broken references`).join("\n")}\n\n## Visual evidence\n${report.visual.map((v) => `- ${v.route} ${v.viewport}: pixel ${v.pixelSimilarity?.toFixed(3)}, layout ${v.layoutSimilarity?.toFixed(3)}, capture alignment ${v.captureAlignment?.status || 'unknown'}, overflow ${v.overflow}${v.error ? " ERROR " + v.error : ""}`).join("\n")}\n\n## Motion checks\n${(report.motionChecks || []).map(v => `- ${v.route} ${v.viewport}: ${v.status}; ${v.samples.length} scroll samples, reduced motion restored: ${v.reducedMotionRestored}`).join("\n") || "No supported motion detected."}\n\nMotion behavior is checked locally, not compared with source JavaScript execution.\n\n## Unsupported functionality\n${report.unsupported.map((v) => `- ${v.route}: ${v.feature}`).join("\n") || "None detected; this is not proof of full functional equivalence."}\n\n## Warnings\n${report.warnings.map((x) => "- " + x).join("\n")}\n\n## Metrics\n\`\`\`json\n${JSON.stringify(report.metrics, null, 2)}\n\`\`\`\n`,
  );
  await checkpoint("Preparing download");
  for (const d of [".ssg-content", ".ssg-templates"])
    await rm(path.join(project, d), { recursive: true, force: true });
  await rm(path.join(project, ".ssg-output"), { recursive: true, force: true });
  await packageProject(dir);
  return { model, report, project, evidence };
  } finally { await network.close?.(); }
}
