import {captureTransport} from '../engine/browser-network.mjs';
import {saveRedirectImport} from './redirect-import.mjs';
import {compatibilityReport,saveFormSettings} from './compatibility.mjs';
import {checkDiskSpace,diskSpaceLabel} from '../engine/disk-space.mjs';
import {createPublishing} from './publishing.mjs';
import {runMigration} from './migration-runner.mjs';
import {startTiming,timingSnapshot,transitionTiming} from './timing.mjs';
import {createBuildStore} from './build-store.mjs';
import {runWithAutoResume,canAutoResume} from './auto-resume.mjs';
import { recoverCompleted } from '../engine/recovery.mjs';
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { json } from "../engine/pipeline.mjs";
import { normalize } from "../engine/network.mjs";
import { fileResponse, resolveStaticFile } from "../engine/static.mjs";
import { prefixPreview, previewScriptCSP } from "./preview.mjs";
import { progressWriter } from "./progress.mjs";
import { availableModels } from "../engine/ai-chat.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = path.resolve(process.env.MIGRATION_DATA_DIR || path.join(root, ".data/jobs"));
await mkdir(data, { recursive: true });
const port = Number(process.env.PORT || 4310),
  previewPort = Number(process.env.PREVIEW_PORT || 4311);
const origin = `http://127.0.0.1:${port}`;
const publishing=await createPublishing({data});
let busy = false, activeId = null;
const failedJobs = new Map(), automaticQueue=[], controls=new Map();
const buildStore = createBuildStore(data, {previewOrigin:`http://127.0.0.1:${previewPort}`, current:id=>failedJobs.get(id), protectedBuild:id=>publishing.activeJobs.has(id) || activeId===id || automaticQueue.some(j=>j.id===id)});
// Recover verified archives before treating interrupted jobs as failed.
for (const name of await readdir(data)) {
  try {
    const file = path.join(data, name, "job.json"),
      j = JSON.parse(await readFile(file));
    if (canAutoResume(j)) {automaticQueue.push(j);continue;}
    if (['running', 'waiting', 'failed'].includes(j.status)) {
      const report = await recoverCompleted(path.join(data, name));
      j.status = report ? 'complete' : 'failed';
      if (j.timing) j.timing = {...j.timing,state:j.status};
      if (report) { j.summary = report; j.preview = `http://127.0.0.1:${previewPort}/${name}/`; delete j.error; }
      else j.error ||= "The application restarted. Resume this migration from its saved checkpoint.";
      await json(file, j);
    }
  } catch {}
}
const send = (res, status, obj) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(obj));
};
const body = async (req, maxBytes = 4096) => {
  let bytes = 0;
  let s = "";
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxBytes) throw Object.assign(Error("Request too large"), {statusCode:413});
    s += chunk;
  }
  return JSON.parse(s);
};
const idOK = (id) => /^[a-f0-9]{48}$/.test(id);
async function startJob(url, { modelKey = "", resumeId = null, rebuild = false, automatic = false, maxPages = null, sampleUrls = null, retryAssets = true, transport = "http" } = {}) {
  if (resumeId && publishing.activeJobs.has(resumeId)) throw Error("This build is being published. Wait for publishing to finish.");
  if (busy)
    throw Error(
      "Another website is being rebuilt. Try again when it finishes.",
    );
  if (resumeId && buildStore.deleting.has(resumeId)) throw Error("This build is being deleted");
  if (maxPages !== null && (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10000)) throw Error("Page cap must be an integer from 1 to 10000");
  normalize(url);
  if(sampleUrls!==null){
    if(!Array.isArray(sampleUrls)||!sampleUrls.length||sampleUrls.length>10000)throw Error('Invalid fixed sample URLs');
    sampleUrls=[...new Set(sampleUrls.map(value=>{const u=new URL(value,url);if(u.origin!==new URL(url).origin||u.username||u.password||u.hash)throw Error('Sample URLs must be same-origin');return u.href;}))];
    maxPages=sampleUrls.length;
  }
  captureTransport(transport);
  let agent = null;
  if (modelKey) {
    agent = (await availableModels()).find(m => `${m.profileId}:${m.model}` === modelKey);
    if (!agent) throw Error("The selected AI Chat model is unavailable");
  }
  if (!resumeId) await checkDiskSpace(data,{phase:"startup"});
  if (busy) throw Error("Another website is being rebuilt. Try again when it finishes.");
  if (resumeId && publishing.activeJobs.has(resumeId)) throw Error("This build is being published. Wait for publishing to finish.");
  if (resumeId && buildStore.deleting.has(resumeId)) throw Error("This build is being deleted");
  busy = true;
  if (resumeId && !idOK(resumeId)) { busy = false; throw Error("Invalid job ID"); }
  const id = resumeId || randomBytes(24).toString("hex"),
    dir = path.join(data, id);
  activeId = id; buildStore.invalidate(id);
  try { if (!resumeId) await mkdir(dir); } catch (error) { busy = false; activeId = null; throw error; }
  let prior;try{prior=resumeId ? JSON.parse(await readFile(path.join(dir,"job.json"))) : null;}catch(error){busy=false;activeId=null;throw error;}
  const job = {
    id,
    url,
    status: "running",
    events: prior?.events || [],
    createdAt: prior?.createdAt || new Date().toISOString(),
    autoResume: {...prior?.autoResume,...(!automatic?{stalled:0}:{})},
    timing: startTiming(rebuild && !automatic ? null : prior?.timing),
    options: { transport, modelKey, aiEnabled: Boolean(modelKey), maxPages, sampleUrls, captureMode: sampleUrls ? "fixed-url-sample" : maxPages == null ? "whole-site" : "explicit-sample", rebuild, retryAssets, autoResume: true },
  };
  try { await json(path.join(dir, "job.json"), job); } catch (error) { busy = false; activeId = null; throw error; }
  let progress = progressWriter(value => json(path.join(dir, "job.json"), {...value,timing:timingSnapshot(value.timing)}), {coalesce:true});
  const event = (stage, counts = {}) => {
    job.stage = stage;
    if(counts.browserWaiting!==undefined){job.browserWaiting=counts.browserWaiting;job.timing=transitionTiming(job.timing,counts.browserWaiting?"waiting":"running");}
    if (counts.aiUsage) job.aiUsage = counts.aiUsage;
    const { aiUsage, ...progressCounts } = counts;
    job.events.push({ stage, ...progressCounts, at: new Date().toISOString() });
    progress.record(job);
  };
  const controller=new AbortController();let browserControl;
  const finished=runWithAutoResume(async({resume})=>{const result=await runMigration(url, dir, {
    fixtureOrigins: (process.env.FIXTURE_ORIGINS || "")
      .split(",")
      .filter(Boolean),
    agent, aiEnabled: Boolean(modelKey), resume, rebuild, maxPages, sampleUrls, retryAssets, transport,
  },{signal:controller.signal,event,onControl:control=>{browserControl=control;}});await progress.flush();return result;}, {signal:controller.signal,dir,resume:Boolean(resumeId),state:job.autoResume,publish:async(status,state)=>{
    try{await progress.flush();}catch(e){if(e.code!=='ENOSPC')throw e;progress=progressWriter(value=>json(path.join(dir,'job.json'),{...value,timing:timingSnapshot(value.timing)}), {coalesce:true});}job.timing=transitionTiming(job.timing,status);job.status=status;job.autoResume={...state};
    const stage=status==='waiting'?(state.reason==='source-unavailable'?'Source is not responding — waiting before retrying saved work':state.reason==='disk-space'?`Waiting for disk space — resumes automatically with ${diskSpaceLabel(state.requiredFreeBytes)} free`:`Download/crawl budget reached — resuming automatically (retry ${state.retries})`):(resumeId||state.retries?'Continuing from saved checkpoint':'Starting migration');
    if(job.stage!==stage){job.stage=stage;job.events.push({stage,at:new Date().toISOString()});}
    try{await json(path.join(dir,'job.json'),job);}catch(e){if(e.code!=='ENOSPC')throw e;}
  }})
    .then(async (result) => {
      await progress.flush();
      if(controller.signal.aborted)throw Object.assign(Error("Migration stopped. Saved checkpoints are retained."),{code:"USER_STOPPED"});
      job.timing = transitionTiming(job.timing,"complete");
      job.status = "complete";
      job.summary = result.report;
      job.preview = `http://127.0.0.1:${previewPort}/${id}/`;
      await json(path.join(dir, "job.json"), job);
    })
    .catch(async (e) => {
      await progress.settle();
      const cancelled=e.code==='USER_STOPPED'||controller.signal.aborted;
      job.timing = transitionTiming(job.timing,cancelled?"cancelled":"failed");
      job.status = cancelled?"cancelled":"failed";job.errorCode=cancelled?"USER_STOPPED":e.code;
      if(cancelled){job.options.autoResume=false;job.autoResume={reason:"user-stopped"};job.stage="Stopped by user";job.events.push({stage:job.stage,at:new Date().toISOString()});}
      job.error = e.code === "ENOSPC" ? "The disk is full. Free space, then resume this migration." : e.message;
      const recovered = rebuild || cancelled ? null : await recoverCompleted(dir).catch(()=>null);
      if (recovered) { job.status = 'complete'; job.summary = recovered; job.preview = `http://127.0.0.1:${previewPort}/${id}/`; delete job.error; }
      failedJobs.set(id, job);
      if (failedJobs.size > 50) failedJobs.delete(failedJobs.keys().next().value);
      try { await json(path.join(dir, "job.json"), job); } catch { console.error("Migration failed and its status could not be saved. Check free disk space."); }
    })
    .finally(() => {
      while(failedJobs.size>50)failedJobs.delete(failedJobs.keys().next().value);
      controls.delete(id);busy = false; activeId = null;
      queueMicrotask(resumeNext);
    });
  controls.set(id,{controller,finished,continueBrowser:()=>browserControl?.continueBrowser()});failedJobs.set(id,job);
  return job;
}
async function resumeNext(){
 if(busy||!automaticQueue.length)return;
 const job=automaticQueue.shift();
 const current=failedJobs.get(job.id);if(current&&!canAutoResume(current)){queueMicrotask(resumeNext);return;}
 try{await startJob(job.url,{...job.options,resumeId:job.id,automatic:true});}
 catch(error){if(busy){automaticQueue.unshift(job);return;}job.status='failed';job.error=error.message;failedJobs.set(job.id,job);try{await json(path.join(data,job.id,'job.json'),job);}catch{}queueMicrotask(resumeNext);}
}
async function withUsage(job) {
  try { job.aiUsage = JSON.parse(await readFile(path.join(data, job.id, 'ai-usage.json'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return {...job,timing:timingSnapshot(job.timing)};
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) {
      res.writeHead(403);
      return res.end("Use the printed local URL");
    }
    const u = new URL(req.url, origin);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (["POST", "DELETE"].includes(req.method) && req.headers.origin !== origin)
      return send(res, 403, { error: "Origin rejected" });
    if(u.pathname==='/api/hosting'&&req.method==='GET')return send(res,200,publishing.status());
    const hosting=u.pathname.match(/^\/api\/hosting\/(github|cloudflare)\/(connect|disconnect|sites)$/);
    if(hosting){const [,provider,action]=hosting;
      if(action==='connect'&&req.method==='POST')return send(res,200,await publishing.connect(provider,(await body(req)).token));
      if(action==='disconnect'&&req.method==='POST')return send(res,200,await publishing.disconnect(provider));
      if(action==='sites'&&req.method==='GET')return send(res,200,{sites:await publishing.sites(provider,u.searchParams.get('account'))});
      if(action==='sites'&&req.method==='POST'){const input=await body(req);if(input.confirmed!==true)return send(res,400,{error:'Confirm creation of the public site.'});return send(res,201,await publishing.create(provider,input));}
      return send(res,405,{error:'Method not allowed'});
    }
    const deployment=u.pathname.match(/^\/api\/deployments\/([a-f0-9]{40})$/);
    if(deployment&&req.method==='GET')return send(res,200,publishing.get(deployment[1]));
    if (req.method === "POST" && u.pathname === "/api/jobs") {
      const input = await body(req,2*1024*1024);
      return send(res, 202, await startJob(input.url, { modelKey: input.modelKey, maxPages: input.maxPages ?? null, sampleUrls:input.sampleUrls??null, transport:input.transport??"http" }));
    }
    if (req.method === "GET" && u.pathname === "/api/jobs") return send(res,200,await buildStore.list());
    const match = u.pathname.match(
      /^\/api\/jobs\/([a-f0-9]{48})(?:\/(download|evidence|deploy|resume|rebuild|stop|browser-continue|compatibility|forms|redirects))?$/,
    );
    if (match) {
      if (!match[2] && req.method === 'DELETE') {
        await buildStore.remove(match[1]);
        failedJobs.delete(match[1]);
        return send(res,200,{deleted:match[1]});
      }
      if (!match[2] && req.method !== 'GET') return send(res,405,{error:'Method not allowed'});
      if (!match[2] && failedJobs.has(match[1])) return send(res, 200, await withUsage(failedJobs.get(match[1])));
      const dir = path.join(data, match[1]);
      const job = failedJobs.get(match[1]) || JSON.parse(await readFile(path.join(dir, "job.json")));
      if(match[2]==='browser-continue'&&req.method==='POST'){
        if(!job.browserWaiting||!controls.has(job.id))return send(res,409,{error:'No browser confirmation is pending'});
        controls.get(job.id).continueBrowser();return send(res,202,{continued:true});
      }
      if(match[2]==='stop'&&req.method==='POST'){
        if(!['running','waiting','cancelled'].includes(job.status))return send(res,409,{error:'Migration is not running'});
        const control=controls.get(job.id);
        job.options.autoResume=false;
        if(control){control.controller.abort();await control.finished;}
        else {const index=automaticQueue.findIndex(j=>j.id===job.id);if(index>=0)automaticQueue.splice(index,1);job.status='cancelled';job.stage='Stopped by user';job.errorCode='USER_STOPPED';job.error='Migration stopped. Saved checkpoints are retained.';job.autoResume={reason:'user-stopped'};job.timing=transitionTiming(job.timing,'cancelled');await json(path.join(dir,'job.json'),job);failedJobs.set(job.id,job);}
        buildStore.invalidate(job.id);return send(res,200,job);
      }
      if(match[2]==='rebuild'&&req.method==='POST'){
        if(busy||job.status==='running')return send(res,409,{error:'A migration is already running'});
        await stat(path.join(dir,'prepared-model.json'));
        const input=Number(req.headers['content-length'])>0?await body(req):{};
        if(input.retryAssets!==undefined&&typeof input.retryAssets!=='boolean')return send(res,400,{error:'retryAssets must be a boolean'});
        return send(res,202,await startJob(job.url,{modelKey:job.options?.modelKey||'',maxPages:job.options?.maxPages??null,sampleUrls:job.options?.sampleUrls??null,transport:job.options?.transport||'http',resumeId:job.id,rebuild:true,retryAssets:input.retryAssets??true}));
      }
      if (match[2] === 'resume' && req.method === 'POST') {
        if (busy || job.status === 'running') return send(res, 409, { error: 'A migration is already running' });
        if (job.status === 'complete') return send(res, 409, { error: 'Migration is already complete' });
        const report = job.options?.rebuild ? null : await recoverCompleted(dir).catch(()=>null);
        if (report) {
          job.status = 'complete'; job.summary = report; job.preview = `http://127.0.0.1:${previewPort}/${job.id}/`; delete job.error;
          await json(path.join(dir, 'job.json'), job); failedJobs.delete(job.id);
          return send(res, 200, job);
        }
        const input=Number(req.headers['content-length'])>0?await body(req):{};
        const transport=captureTransport(input.transport??job.options?.transport??'http');
        return send(res, 202, await startJob(job.url, { ...job.options, transport, resumeId: job.id, rebuild: false }));
      }
      if (!match[2]) return send(res, 200, await withUsage(job));
      if (job.status !== "complete")
        return send(res, 409, { error: "Migration is not ready" });
      if(match[2]==='compatibility'&&req.method==='GET')return send(res,200,await compatibilityReport(dir));
      if(match[2]==='redirects'&&req.method==='POST'){
        if(publishing.activeJobs.has(job.id)||buildStore.deleting.has(job.id))return send(res,409,{error:'This build is busy'});
        return send(res,200,await saveRedirectImport(dir,await body(req,8*1024*1024)));
      }
      if(match[2]==='forms'&&req.method==='POST'){
        if(publishing.activeJobs.has(job.id)||buildStore.deleting.has(job.id))return send(res,409,{error:'This build is busy'});
        return send(res,200,await saveFormSettings(dir,await body(req)));
      }
      if (match[2] === "download") {
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="your-website.zip"',
        );
        return fileResponse(res, dir, "/website.zip");
      }
      if (match[2] === "evidence") {
        const kind = u.searchParams.get("kind"),
          file = u.searchParams.get("file");
        if (
          !["source", "rebuilt"].includes(kind) ||
          !/^\w+-\w+\.png$/.test(file || "")
        )
          return send(res, 400, { error: "Invalid evidence" });
        return fileResponse(res, path.join(dir, "evidence", kind), "/" + file);
      }
      if(match[2]==='deploy'&&req.method==='GET')return send(res,200,{deployments:publishing.history(job.id)});
      if(match[2]==='deploy'&&req.method==='POST'){const input=await body(req);if(buildStore.deleting.has(job.id)||activeId===job.id)return send(res,409,{error:'This build is being changed. Wait for that operation to finish.'});return send(res,202,await publishing.publish(job,input));}
    }
    if (u.pathname === "/api/models") {
      try { return send(res, 200, { models: await availableModels(), preferred: process.env.MIGRATION_AI_MODEL || "gpt-6-astra" }); }
      catch { return send(res, 200, { models: [], error: "AI Chat is unavailable. Start AI Chat or use source preservation without AI." }); }
    }
    if (u.pathname === "/api/config")
      return send(res, 200, {
        consultationURL: process.env.CONSULTATION_URL || null,
      });
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'; style-src 'self'; frame-src http://127.0.0.1:${previewPort}; img-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'`,
    );
    return fileResponse(
      res,
      path.join(root, "app"),
      u.pathname === "/" ? "/index.html" : u.pathname,
      { preview: false },
    );
  } catch (e) {
    send(res, e.statusCode || (e.code === "ENOENT" ? 404 : 400), { error: e.code === "ENOENT" ? "Not found" : e.message });
  }
});
const preview = http.createServer(async (req, res) => {
  if (req.headers.host !== `127.0.0.1:${previewPort}`) {
    res.writeHead(403);
    return res.end();
  }
  const url = new URL(req.url, "http://localhost");
  const m = url.pathname.match(/^\/([a-f0-9]{48})(\/.*)$/);
  if (!m) {
    res.writeHead(404);
    return res.end("Preview unavailable");
  }
  const dir = path.join(data, m[1], "project/output");
  // Root-relative exported references stay inside the opaque job prefix in preview only.
  if (m[2].endsWith("/") || m[2].endsWith(".html") || !path.posix.extname(m[2])) {
    try {
      const file = await resolveStaticFile(dir, m[2].endsWith("/") || path.posix.extname(m[2]) ? m[2] : m[2] + "/");
      let html = await readFile(file, "utf8");
      html = prefixPreview(html, m[1]);
      res.writeHead(200, {
        "content-type": "text/html",
        "content-security-policy": `default-src 'none'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; ${previewScriptCSP} sandbox allow-same-origin allow-scripts; frame-ancestors ${origin}; form-action 'none'; base-uri 'none'`,
        "x-robots-tag": "noindex, nofollow",
      });
      return res.end(html);
    } catch {
      res.writeHead(404);
      return res.end("Not found");
    }
  }
  return fileResponse(res, dir, m[2]);
});
await new Promise((r) => preview.listen(previewPort, "127.0.0.1", r));
await new Promise((r) => server.listen(port, "127.0.0.1", r));
console.log(`CLONER: ${origin}`);

void resumeNext();
