import {waitForFonts} from './font-readiness.mjs';
import {componentCoverage} from './component-coverage.mjs';
import {createHash} from 'node:crypto';
import {restoreFormValidation} from './form-validation.mjs';
import {renderedDocument} from './form-appearance.mjs';
import {extract} from './extract.mjs';
import {templateRole} from './template-roles.mjs';
import {mapWordpress} from './wordpress.mjs';
import { chromium } from "playwright";
import { mkdir,access } from "node:fs/promises";
import path from "node:path";
// Bump when measurement semantics change; never compare incompatible cached evidence.
export const captureMeasurementVersion = 1;
export const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];
export function captureSamples(model){
 mapWordpress(model);
 const seen=new Set(),covered=new Set(),samples=[],coverage=new Map();
 for(const page of model.pages){const keys=componentCoverage(page);coverage.set(page,keys);const role=templateRole(page,model.source).role;if(!seen.has(role)){seen.add(role);keys.forEach(key=>covered.add(key));samples.push({...page,captureRole:role,captureComponents:keys});}}
 for(const page of model.pages){const keys=coverage.get(page),missing=keys.filter(key=>!covered.has(key));if(!missing.length)continue;keys.forEach(key=>covered.add(key));samples.push({...page,captureRole:'component-'+createHash('sha256').update(page.route||page.url).digest('hex').slice(0,12),captureComponents:keys});}
 return samples;
}
export function needsRenderedCapture(page,sampled,hydrateRemaining){return sampled||hydrateRemaining||Boolean(page.sourceForms?.length)||/\bdmContent\b/.test(page.sourceHTML||'');}
export async function missingCaptureSamples(model,dir){
 const planned=captureSamples(model),valid=[];
 for(const entry of model.captures||[]){if(entry.measurementVersion!==captureMeasurementVersion)continue;if(entry.measurements?.overflow&&!entry.measurements?.horizontalOverflow)continue;if(entry.viewport?.name!=='desktop'&&entry.initialViewport!==true)continue;if(!viewports.some(v=>v.name===entry.viewport?.name)||!/^[a-zA-Z0-9_-]+\.png$/.test(entry.file||''))continue;try{await access(path.join(dir,entry.file));valid.push(entry);}catch(error){if(error.code!=='ENOENT')throw error;}}
 const present=new Set(valid.map(c=>c.route+'\0'+c.viewport.name));
 return {planned,valid,samples:planned.filter(p=>viewports.some(v=>!present.has(p.route+'\0'+v.name))),present};
}
export async function capture(model, network, dir,{supplement=false,evidenceOnly=false,onEvent=()=>{},resume=false,onCheckpoint=async()=>{}}={}) {
  const start = Date.now();
  await mkdir(dir, { recursive: true });
  const coverage=(supplement||resume)?await missingCaptureSamples(model,dir):null;
  const allSamples=coverage?.planned||captureSamples(model),samples=coverage?.samples||allSamples;
  model.capturePlan=allSamples.map(p=>({route:p.route,role:p.captureRole,components:p.captureComponents}));
  model.captures=coverage?.valid||[];
  const extras=supplement?[]:model.pages.filter(p=>!allSamples.some(s=>s.route===p.route)&&(!resume||!p.hydratedContent));
    if(resume){model.metrics.renderedContentPages=model.pages.filter(p=>p.hydratedContent).length;model.metrics.extraBrowserPages=model.pages.filter(p=>p.hydratedContent&&!allSamples.some(s=>s.route===p.route)).length;}
  if(!samples.length&&!extras.length)return;
  const browser = network.browserCapture ? null : await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "chrome",
  });
  try {
    // Some hosted builders replace their stylesheet set during hydration.
    // Inspect every such page once; only role samples need three screenshots.
    let hydrateRemaining=model.captureRenderAll===true;if(!supplement&&!resume){model.metrics.renderedContentPages=0;model.metrics.extraBrowserPages=0;}
    const candidates=[...samples,...extras];
    let candidateIndex=0;
    for (const p of candidates) {
      candidateIndex++;
      const sampled=samples.some(s=>s.route===p.route);
      if(!needsRenderedCapture(p,sampled,hydrateRemaining))continue;
      if(!sampled)model.metrics.extraBrowserPages++;
      const context = network.browserCapture ? await network.captureContext() : await browser.newContext({
          viewport: viewports[0],
          reducedMotion: "reduce",
          javaScriptEnabled: true,
          serviceWorkers: "block",
          acceptDownloads: false,
        });
        const failedStyles = [];
        if(!network.browserCapture)await context.route("**/*", async (route) => {
          try {
            if (
              !["GET", "HEAD"].includes(route.request().method()) ||
              !["document", "stylesheet", "image", "font", "script", "xhr", "fetch"].includes(
                route.request().resourceType(),
              )
            )
              return route.abort();
            const r = await network.get(route.request().url());
            if(route.request().resourceType()==='stylesheet'&&r.status!==200)failedStyles.push({url:route.request().url(),error:'HTTP '+r.status});
            await route.fulfill({
              status: r.status,
              contentType: String(
                r.headers["content-type"] || "application/octet-stream",
              ),
              body: r.body,
            });
          } catch (error) {
            if(route.request().resourceType()==="stylesheet")failedStyles.push({url:route.request().url(),error:error.message});
            return route.abort();
          }
        });
        const page = await context.newPage();
        if(network.browserCapture)await page.emulateMedia({reducedMotion:"reduce"});
        const pendingRequests=new Set();let lastNetworkActivity=Date.now();
        page.on('request',request=>{pendingRequests.add(request);lastNetworkActivity=Date.now();});
        const finished=request=>{pendingRequests.delete(request);lastNetworkActivity=Date.now();};
        page.on('requestfinished',finished);page.on('requestfailed',finished);
        page.setDefaultTimeout(12000);
        try { for (const vp of (sampled?viewports.filter(v=>!coverage?.present.has(p.route+'\0'+v.name)):[viewports[0]])) {
        try {
          onEvent(`Understanding design: ${p.route} (${vp.name})`,{captureProgress:{candidate:candidateIndex,totalCandidates:candidates.length,route:p.route,viewport:vp.name,sampled}});
          await page.setViewportSize({width:vp.width,height:vp.height});
          {
            // Initialize responsive scripts at the target width, just as verification does.
            // Resizing an already initialized desktop widget can retain stale dimensions.
            await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 20000 });
            // Polling/analytics may never go idle. The checks below still wait
            // for fonts, lazy content and active styles; idle is only a hint.
            await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
          }
          await waitForFonts(page);
          // Reuse this visit for lazy presentation and rendered content; no second crawl.
          await revealLazyContent(page);
          const settleDeadline=Date.now()+5000;
          while(Date.now()<settleDeadline&&(pendingRequests.size||Date.now()-lastNetworkActivity<250))await new Promise(resolve=>setTimeout(resolve,25));
          if(pendingRequests.size)model.warnings.push(`Capture ${p.route} ${vp.name}: lazy network activity did not settle within five seconds`);
          const styles=await page.evaluate(()=>[...document.querySelectorAll('link[rel="stylesheet"],style')].map(el=>el.tagName==='STYLE'?{text:el.textContent,media:el.media}:{url:el.href,media:el.media}).filter(e=>e.text||e.url));
          // Ignore requests for styles the source runtime deliberately removed.
          const activeFailures=failedStyles.filter(f=>styles.some(s=>s.url===f.url));
          if(activeFailures.length)throw Error('Source stylesheet capture incomplete: '+activeFailures.map(x=>x.url).join(', '));
          if(vp.name==='desktop'&&!evidenceOnly){
            const target=model.pages.find(item=>item.route===p.route);
            if(target){
              // Keep discovered CMS/provenance data, but parse the initialized public DOM
              // through the same sanitizer/content extractor as a normal document.
              const hydrated=extract(await renderedDocument(page),page.url());
              if((target.sourceSemanticText||target.sourceContentText)!==hydrated.sourceSemanticText){hydrateRemaining=true;model.captureRenderAll=true;}
              model.metrics.renderedContentPages++;
              const fields=['sourceForms','sourceSEO','sourceHTML','documentAttributes','bodyClass','mainId','mainClass','mainStyle','wrapperClass','content','shell','header','footer','blocks','text','sourceContentText','sourceSemanticText','sourceArticleCount','dynamic'];
              restoreFormValidation(target.sourceForms,hydrated.sourceForms);
              for(const key of fields)target[key]=hydrated[key];
              target.styleSources=styles;target.css=styles.filter(x=>x.url).map(x=>x.url);target.inlineCss=styles.filter(x=>x.text).map(x=>x.text);target.hydratedStyles=true;target.hydratedContent=true;
            }
          }
          if(!sampled)continue;

          const measurements = await measure(page);
          const file = `${p.captureRole}-${vp.name}.png`;
          await page.screenshot({
            path: path.join(dir, file),
            fullPage: true,
            animations: "disabled",
            timeout: 45000,
          });
          model.captures.push({
            route: p.route,
            family: p.captureRole,
            viewport: vp,
            initialViewport: true,
            measurementVersion: captureMeasurementVersion,
            reducedMotion: "reduce",
            fullPage: true,
            file,
            measurements,
          });
        } catch (e) {
          model.warnings.push(`Capture ${p.route} ${vp.name}: ${e.message}`);
        }
        }} finally { await context.close(); }
        await onCheckpoint(model.pages.find(item=>item.route===p.route));
        // Preserve completed pages before honoring a transient source outage.
        // Continuing every remaining page only repeats failed work.
        if(network.outage)throw network.outage;
    }
  } finally {
    await browser?.close();
  }
  if(network.outage)throw network.outage;
  model.metrics.sourceBrowserMs = (supplement?(model.metrics.sourceBrowserMs||0):0)+Date.now()-start;
}
export async function measure(page) {
  return page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll(
        "header,nav,main,article,h1,h2,p,img,footer",
      ),
    ]
      .slice(0, 80)
      .map((e) => {
        const r = e.getBoundingClientRect(),
          s = getComputedStyle(e);
        return {
          tag: e.tagName,
          selector: e.tagName.toLowerCase() + (e.id ? "#" + CSS.escape(e.id) : "") + [...e.classList].map(c => "." + CSS.escape(c)).join(""),
          text: (e.innerText || "").replace(/\s+/g, ' ').trim().slice(0, 90),
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          font: s.fontFamily,
          size: s.fontSize,
          color: s.color,
          background: s.backgroundColor,
          display: s.display,
          gap: s.gap,
          padding: s.padding,
        };
      });
    return {
      elements,
      scrollPosition: {x:scrollX,y:scrollY},
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      horizontalOverflow: (()=>{
        const scrollWidth=document.documentElement.scrollWidth;
        if(scrollWidth<=innerWidth+1)return {viewportWidth:innerWidth,scrollWidth,hiddenOnly:false};
        const beyond=[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.right>innerWidth+1;});
        const hidden=el=>{if(['hidden','collapse'].includes(getComputedStyle(el).visibility))return true;for(let node=el;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)===0)return true;return false;};
        return {viewportWidth:innerWidth,scrollWidth,hiddenOnly:beyond.length>0&&beyond.every(hidden)};
      })(),
      centerElement: (() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); const s = e && getComputedStyle(e); return e ? { tag: e.tagName, id: e.id, className: e.className, background: s.backgroundColor, position: s.position, zIndex: s.zIndex } : null; })(),
      body: {
        font: getComputedStyle(document.body).fontFamily,
        color: getComputedStyle(document.body).color,
        background: getComputedStyle(document.body).backgroundColor,
      },
    };
  });
}

// Source and rebuilt screenshots must initialize below-the-fold images equally.
// One bounded scroll pass; no navigation or source scripts are introduced.
export async function revealLazyContent(page) {
  await page.evaluate(async()=>{
    for(let y=0,end=document.documentElement.scrollHeight;y<end;y+=innerHeight){
      scrollTo({left:0,top:y,behavior:"instant"});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    }
    await Promise.race([
      Promise.all([...document.images].filter(img=>!img.complete).map(img=>new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))),
      new Promise(resolve=>setTimeout(resolve,2000)),
    ]);
    scrollTo({left:0,top:0,behavior:"instant"});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  });
}
