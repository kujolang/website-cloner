const $ = (s) => document.querySelector(s);
let job, consult, lastPoll = 0, pollTimer;
setInterval(() => { if (!$("#progress").hidden && lastPoll) $("#heartbeat").textContent = `Connected · last checked ${Math.floor((Date.now() - lastPoll) / 1000)}s ago. ${job?.browserWaiting ? "Waiting for your review in the source browser." : job?.status === "waiting" ? "Automatic continuation is enabled." : "Work continues between stage updates."}`; }, 1000);
function show(id) {
  document.body.classList.toggle("is-home", id === "submit");
  if (id === "progress") $("#heartbeat").after($("#migration-time"));
  if (id === "result") $("#result-timing").append($("#migration-time"));
  for (const x of ["submit", "progress", "result"])
    $("#" + x).hidden = x !== id;
}
async function poll(id) {
  clearTimeout(pollTimer);
  try {
    const r = await fetch("/api/jobs/" + id);
    const next = await r.json();
    if (!r.ok) throw Object.assign(Error(next.error || "Unable to check migration"), {status:r.status});
    job = next;
    $("#resume-browser").hidden=true;
    $("#transport").value=job.options?.transport||"http";
    $('#browser-continue').hidden=!job.browserWaiting||job.status!=='running';
    $('#browser-help').hidden=$('#browser-continue').hidden;
    lastPoll = Date.now();
    renderTime();
    renderUsage(job.aiUsage || job.summary?.aiUsage);
    if(job.status==='cancelled'){
      show('progress');$('#stage').textContent='Migration stopped';$('#activity-status').textContent='Stopped';$('#stop').hidden=true;$('#progress').classList.add('is-stopped');$('#heartbeat').textContent='Saved checkpoints are retained. Start another migration below.';lastPoll=0;document.dispatchEvent(new Event('builds-changed'));return;
    }
    $('#progress').classList.remove('is-stopped');$('#stop').hidden=false;
    if (job.status === "failed") {
      show("progress"); lastPoll = 0;
      $("#progress").classList.add("is-stopped");
      $("#activity-status").textContent = "Needs attention";
      $("#stage").textContent = job.stage || "Migration paused";
      $("#heartbeat").textContent = job.error || "Migration failed. Your saved progress is retained.";
      $("#stop").hidden = true;
      $("#progress").append($("#resume")); $("#resume").hidden = false;
      $("#progress").append($("#resume-browser"));$("#resume-browser").hidden=job.options?.transport==="browser";
      document.dispatchEvent(new Event("builds-changed"));
      return;
    }
    if (job.status === "complete") {
      render();
      document.dispatchEvent(new Event("builds-changed"));
      return;
    }
    $("#resume").hidden = true;
    if (document.querySelector("#progress").hidden) document.dispatchEvent(new Event("builds-changed"));
    show("progress");
    $("#activity-status").textContent = job.browserWaiting ? "Waiting for your browser review" : job.status === "waiting" ? "Waiting · auto-resume enabled" : "Running";
    const latest = job.events.at(-1);
    const transfer = latest?.assetProgress;
    $("#transfer-status").hidden = !transfer;
    if(transfer) $("#transfer-status").textContent = `${transfer.assets} assets saved · ${transfer.failedAssets||0} unavailable · ${transfer.activeDownloads||0} active / ${transfer.queuedDownloads||0} queued downloads · ${transfer.retries||0} retries · ${Math.round((transfer.bytesPerSecond||0)/1024)} KB/s`;
    $("#stage").textContent = (job.stage || "Inspecting website") + (latest?.pages != null ? ` · ${latest.pages} pages captured · ${latest.queued ?? "?"} queued` : "");
    $("#events").replaceChildren(
      ...[...new Set(job.events.map((e) => e.stage))].map((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        return li;
      }),
    );
    pollTimer = setTimeout(() => poll(id), 1500);
  } catch (e) {
    show("progress"); lastPoll = 0;
    $("#activity-status").textContent = e.status === 404 ? "Not found" : "Reconnecting";
    $("#heartbeat").textContent = e.status === 404 ? "This saved migration no longer exists." : "Connection interrupted. Retrying automatically; your migration stays saved.";
    $("#stop").hidden = !job || e.status === 404;
    if (e.status !== 404) pollTimer = setTimeout(() => poll(id), 3000);
  }
}
$('#browser-continue').addEventListener('click',async()=>{const button=$('#browser-continue');button.disabled=true;try{const r=await fetch(`/api/jobs/${job.id}/browser-continue`,{method:'POST'});const result=await r.json();if(!r.ok)throw Error(result.error);await poll(job.id);}catch(e){$('#stop-error').hidden=false;$('#stop-error').textContent=e.message;}finally{button.disabled=false;}});
$('#stop').addEventListener('click',async()=>{
 const button=$('#stop');button.disabled=true;$('#stop-error').hidden=true;
 try{const response=await fetch(`/api/jobs/${job.id}/stop`,{method:'POST'}),result=await response.json();if(!response.ok)throw Error(result.error);await poll(job.id);}
 catch(error){$('#stop-error').textContent=error.message;$('#stop-error').hidden=false;}
 finally{button.disabled=false;}
});
$("#resume-browser").addEventListener("click",()=>{$("#transport").value="browser";$("#resume").click();});
$("#resume").addEventListener("click", async () => {
  const button = $("#resume"); button.disabled = true;
  try {
    const response = await fetch(`/api/jobs/${job.id}/resume`, { method: 'POST', headers:{"content-type":"application/json"}, body:JSON.stringify({transport:$("#transport").value}) });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    poll(result.id);
  } catch (error) { $("#heartbeat").textContent = error.message; }
  finally { button.disabled = false; }
});
$('#rebuild').addEventListener('click',async()=>{
 const button=$('#rebuild');button.disabled=true;
 try{const response=await fetch(`/api/jobs/${job.id}/rebuild`,{method:'POST'});const result=await response.json();if(!response.ok)throw Error(result.error);await poll(result.id);}
 catch(error){$('#error').textContent=error.message;show('submit');}finally{button.disabled=false;}
});
$("#start").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#error").textContent = "";
  const button = e.target.querySelector("button");
  button.disabled = true;
  try {
    const r = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: $("#url").value, modelKey: $("#model").value, transport:$("#transport").value }),
    });
    const j = await r.json();
    if (!r.ok) throw Error(j.error);
    history.replaceState(null, "", "?job=" + j.id);
    poll(j.id);
  } catch (e) {
    $("#error").textContent = e.message;
  } finally {
    button.disabled = false;
  }
});
function renderUsage(receipt) {
  const panel = $('#ai-usage');
  panel.hidden = job?.options?.aiEnabled === false || (!job?.options?.modelKey && job?.options?.aiEnabled !== true && !receipt?.totals?.calls);
  if (panel.hidden) return;
  if (!receipt) { $('#usage-summary').textContent = 'Token usage was not recorded for this older run.'; $('#usage-rounds').replaceChildren(); return; }
  const number = value => value == null ? 'Not reported' : value.toLocaleString();
  const total = (name) => {
    const value = receipt.totals[name];
    return value.missing ? `${number(value.known)} reported; ${value.missing} unreported round(s)` : number(value.known);
  };
  $('#usage-summary').textContent = `${receipt.totals.calls} AI calls · Input: ${total('input')} · Output: ${total('output')} · Cached input: ${total('cached')} · Total: ${total('total')}. ${receipt.totals.complete ? '' : 'Usage is incomplete.'}`;
  $('#usage-rounds').replaceChildren(...receipt.rounds.map((round, i) => {
    const tr = document.createElement('tr');
    for (const value of [i + 1, `${round.stage} · ${round.model}`, `${round.status}${round.tokens.complete ? '' : ' · usage incomplete'}`, number(round.tokens.input), number(round.tokens.output), number(round.tokens.cached), number(round.tokens.total)]) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    return tr;
  }));
}
function render() {
  show("result");
  const r = job.summary;
  renderUsage(r.aiUsage || job.aiUsage);
  $("#result-title").textContent = r.status === "failed-quality-checks" ? "This migration failed quality checks" : r.status === "verified-within-scope" ? "Your website is ready to review" : "Your migration needs review";
  $("#agent-summary").textContent = r.agent ? `AI review${r.agent.rounds.some(round => round.error) ? " needs attention" : " completed"}: ${r.agent.selection.model} · ${r.metrics.aiCalls} calls · ${r.agent.rounds.filter(round => round.accepted).length} accepted repairs. See agent-trace.json in the download.` : "Source preservation only · No AI review ran.";
  $("#download").href = $("#other-download").href =
    "/api/jobs/" + job.id + "/download";
  $("#preview").src = $("#open-preview").href = job.preview;
  $("#summary").replaceChildren(
    ...[
      [r.metrics.pagesGenerated, "pages rebuilt"],
      [
        (r.metrics.routePreservation * 100).toFixed(0) + "%",
        "captured routes kept",
      ],
      [
        (r.metrics.contentCoverage * 100).toFixed(0) + "%",
        "captured text retained",
      ],
      [
        r.status === "verified-within-scope" ? "Checks passed" : r.status === "failed-quality-checks" ? "Quality checks failed" : "Review needed",
        "migration result",
      ],
    ].map(([n, t]) => {
      const d = document.createElement("div"),
        b = document.createElement("b"),
        s = document.createElement("span");
      b.textContent = n;
      s.textContent = t;
      d.append(b, s);
      return d;
    }),
  );
  const findings = [
    ...(r.audit ? [`SEO and performance: ${r.audit.status} · ${r.audit.pages} pages checked · ${r.audit.performanceSamples} lab samples. Full evidence is in the download's audit folder. Field performance and search visibility require separate data.`] : []),
    ...(r.qualityFailures || []),
    ...new Set(r.unsupported.map((v) => v.feature)),
    ...r.warnings,
  ];
  if (r.discovery.limited)
    findings.unshift(
      "Discovery is incomplete. Some queued destinations remain outside this export.",
    );
  if (
    r.visual.some((v) => v.pixelSimilarity < 0.9 || v.layoutSimilarity < 0.85)
  )
    findings.unshift(
      "Some layouts differ from the original. Please compare the screenshots before publishing.",
    );
  if (r.visual.some((v) => v.a11y?.length))
    findings.push(
      "Accessibility checks found items requiring review. Details are included in your download.",
    );
  if (!findings.length)
    findings.push(
      "No blocking problems detected within the captured scope. Review the preview before publishing.",
    );
  $("#findings").replaceChildren(
    ...findings.map((s) => {
      const p = document.createElement("p");
      p.className = "finding";
      p.textContent = s;
      return p;
    }),
  );
  document.dispatchEvent(new CustomEvent('hosting-build',{detail:{id:job.id,quality:r.status}}));
  const c = r.visual[0];
  if (c) {
    $("#original-shot").src =
      `/api/jobs/${job.id}/evidence?kind=source&file=${c.source}`;
    $("#rebuilt-shot").src =
      `/api/jobs/${job.id}/evidence?kind=rebuilt&file=${c.rebuilt}`;
  }
}
$("#mobile").onclick = () => ($("#preview").style.width = "390px");
$("#desktop").onclick = () => ($("#preview").style.width = "100%");
fetch("/api/config")
  .then((r) => r.json())
  .then((c) => {
    if (c.consultationURL && /^https:\/\//.test(c.consultationURL)) {
      consult = c.consultationURL;
      $("#consult").hidden = false;
      $("#consult-unconfigured").hidden = true;
      $("#consult").href = consult;
    }
  });
$("#include-findings").onchange = () => {
  if (!consult) return;
  const u = new URL(consult);
  if ($("#include-findings").checked && job)
    u.searchParams.set(
      "migration",
      `${job.summary.metrics.pagesGenerated} pages; ${job.summary.unsupported.length} unsupported features; ${job.summary.status}`,
    );
  $("#consult").href = u.href;
};
const id = new URL(location.href).searchParams.get("job");
if (id && /^[a-f0-9]{48}$/.test(id)) poll(id);

fetch("/api/models").then(r => r.json()).then(data => {
  for (const m of data.models) {
    const option = document.createElement("option");
    option.value = `${m.profileId}:${m.model}`; option.textContent = m.label;
    $("#model").append(option);
  }

}).catch(() => {});

function renderTime() {
  const element = $('#migration-time'); element.hidden = !job?.timing;
  if (!job?.timing) return;
  const t=job.timing, delta=['running','waiting'].includes(t.state)?Math.max(0,Date.now()-t.since):0;
  const duration=ms=>{const sec=Math.floor(ms/1000);return `${Math.floor(sec/3600)}h ${Math.floor(sec/60)%60}m ${sec%60}s`;};
  element.title = 'Migration work and waiting time; offline time excluded.';
  element.replaceChildren(...[
    `Work ${duration(t.workMs+(t.state==='running'?delta:0))}`,
    `Waiting ${duration(t.waitMs+(t.state==='waiting'?delta:0))}`,
  ].map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
}
setInterval(renderTime,1000);
